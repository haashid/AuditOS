from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from core.database import get_db
from core.security import get_current_user
from models.marketplace import FreelancerProfile, MarketplaceJob, JobBid

router = APIRouter()

# ── Freelancer Profiles ───────────────────────────────────────

class ProfileCreate(BaseModel):
    specialties: List[str]
    hourly_rate: float


@router.post("/marketplace/profile")
def create_profile(
    body: ProfileCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(FreelancerProfile).filter(FreelancerProfile.user_id == current_user.id).first()
    if profile:
        profile.specialties = body.specialties
        profile.hourly_rate = body.hourly_rate
    else:
        profile = FreelancerProfile(
            user_id=current_user.id,
            specialties=body.specialties,
            hourly_rate=body.hourly_rate
        )
        db.add(profile)
        
    db.commit()
    db.refresh(profile)
    return {
        "id": str(profile.id),
        "specialties": profile.specialties,
        "hourly_rate": float(profile.hourly_rate)
    }


@router.get("/marketplace/profile")
def get_profile(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(FreelancerProfile).filter(FreelancerProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    return {
        "id": str(profile.id),
        "specialties": profile.specialties,
        "hourly_rate": float(profile.hourly_rate),
        "rating": float(profile.rating),
        "is_verified": profile.is_verified
    }


# ── Jobs ──────────────────────────────────────────────────────

class JobCreate(BaseModel):
    engagement_id: str
    title: str
    description: str
    budget_type: str
    budget_amount: float


@router.post("/marketplace/jobs")
def create_job(
    body: JobCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Any firm user can post a job for their org
    job = MarketplaceJob(
        org_id=current_user.org_id,
        engagement_id=body.engagement_id,
        title=body.title,
        description=body.description,
        budget_type=body.budget_type,
        budget_amount=body.budget_amount
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return {"id": str(job.id), "title": job.title, "status": job.status}


@router.get("/marketplace/jobs")
def list_open_jobs(
    db: Session = Depends(get_db)
):
    # Any authenticated user can see open jobs
    jobs = db.query(MarketplaceJob).filter(MarketplaceJob.status == "Open").order_by(MarketplaceJob.created_at.desc()).all()
    return [
        {
            "id": str(j.id),
            "org_id": str(j.org_id),
            "title": j.title,
            "description": j.description,
            "budget_type": j.budget_type,
            "budget_amount": float(j.budget_amount),
            "status": j.status,
            "created_at": j.created_at
        }
        for j in jobs
    ]


@router.get("/marketplace/my-jobs")
def list_my_firm_jobs(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    jobs = db.query(MarketplaceJob).filter(MarketplaceJob.org_id == current_user.org_id).order_by(MarketplaceJob.created_at.desc()).all()
    
    result = []
    for j in jobs:
        bids = db.query(JobBid).filter(JobBid.job_id == j.id).all()
        result.append({
            "id": str(j.id),
            "title": j.title,
            "status": j.status,
            "budget_amount": float(j.budget_amount),
            "bids_count": len(bids)
        })
    return result


# ── Bids ──────────────────────────────────────────────────────

class BidCreate(BaseModel):
    bid_amount: float
    cover_letter: str


@router.post("/marketplace/jobs/{job_id}/bid")
def place_bid(
    job_id: str,
    body: BidCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(FreelancerProfile).filter(FreelancerProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=400, detail="You must create a freelancer profile first")

    job = db.query(MarketplaceJob).filter(MarketplaceJob.id == job_id).first()
    if not job or job.status != "Open":
        raise HTTPException(status_code=400, detail="Job not available")

    bid = JobBid(
        job_id=job_id,
        freelancer_id=profile.id,
        bid_amount=body.bid_amount,
        cover_letter=body.cover_letter
    )
    db.add(bid)
    db.commit()
    return {"status": "success", "bid_id": str(bid.id)}


@router.get("/marketplace/jobs/{job_id}/bids")
def get_job_bids(
    job_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    job = db.query(MarketplaceJob).filter(MarketplaceJob.id == job_id).first()
    if not job or job.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Job not found")

    bids = db.query(JobBid).filter(JobBid.job_id == job_id).all()
    return [
        {
            "id": str(b.id),
            "freelancer_id": str(b.freelancer_id),
            "bid_amount": float(b.bid_amount),
            "cover_letter": b.cover_letter,
            "status": b.status
        }
        for b in bids
    ]


@router.post("/marketplace/bids/{bid_id}/accept")
def accept_bid(
    bid_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    bid = db.query(JobBid).filter(JobBid.id == bid_id).first()
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")

    job = db.query(MarketplaceJob).filter(MarketplaceJob.id == bid.job_id).first()
    if job.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Not your job")

    if job.status != "Open":
        raise HTTPException(status_code=400, detail="Job already assigned")

    # Accept this bid
    bid.status = "Accepted"
    job.status = "Assigned"
    
    # Reject other bids
    other_bids = db.query(JobBid).filter(JobBid.job_id == job.id, JobBid.id != bid.id).all()
    for ob in other_bids:
        ob.status = "Rejected"

    db.commit()
    return {"status": "Bid accepted, Job assigned"}
