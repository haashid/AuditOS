"use client";

import { useEffect, useState } from "react";
import { Briefcase, Users, CheckCircle, ChevronDown, ChevronUp, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("auditos_token") : null;
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });
const jsonHeaders = () => ({ "Content-Type": "application/json", ...authHeaders() });

export default function MarketplacePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("find_jobs");

  // State
  const [profile, setProfile] = useState<any>(null);
  const [openJobs, setOpenJobs] = useState<any[]>([]);
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [engagements, setEngagements] = useState<any[]>([]);

  // UI state
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [bidsForJob, setBidsForJob] = useState<any[]>([]);

  // Forms
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showBidModal, setShowBidModal] = useState<string | null>(null); // job_id
  const [loading, setLoading] = useState(false);

  const [profileForm, setProfileForm] = useState({ specialties: "", hourly_rate: "50" });
  const [jobForm, setJobForm] = useState({ engagement_id: "", title: "", description: "", budget_type: "Fixed", budget_amount: "500" });
  const [bidForm, setBidForm] = useState({ bid_amount: "", cover_letter: "" });

  const fetchData = async () => {
    try {
      const [profRes, openRes, myRes, engRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/marketplace/profile`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/v1/marketplace/jobs`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/v1/marketplace/my-jobs`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/v1/engagements`, { headers: authHeaders() })
      ]);
      if (profRes.ok) setProfile(await profRes.json());
      if (openRes.ok) setOpenJobs(await openRes.json());
      if (myRes.ok) setMyJobs(await myRes.json());
      if (engRes.ok) {
        const engs = await engRes.json();
        setEngagements(engs);
        if (engs.length > 0) setJobForm(p => ({ ...p, engagement_id: engs[0].id }));
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchData(); }, []);

  const saveProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/marketplace/profile`, {
        method: "POST", headers: jsonHeaders(),
        body: JSON.stringify({
          specialties: profileForm.specialties.split(",").map(s => s.trim()),
          hourly_rate: parseFloat(profileForm.hourly_rate)
        })
      });
      if (res.ok) {
        alert("Profile saved");
        setShowProfileModal(false);
        fetchData();
      }
    } catch { alert("Failed to save profile"); }
    finally { setLoading(false); }
  };

  const postJob = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/marketplace/jobs`, {
        method: "POST", headers: jsonHeaders(),
        body: JSON.stringify({
          engagement_id: jobForm.engagement_id,
          title: jobForm.title,
          description: jobForm.description,
          budget_type: jobForm.budget_type,
          budget_amount: parseFloat(jobForm.budget_amount)
        })
      });
      if (res.ok) {
        alert("Job posted");
        setShowJobModal(false);
        setJobForm({ engagement_id: engagements[0]?.id || "", title: "", description: "", budget_type: "Fixed", budget_amount: "500" });
        fetchData();
      }
    } catch { alert("Failed to post job"); }
    finally { setLoading(false); }
  };

  const submitBid = async () => {
    if (!showBidModal) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/marketplace/jobs/${showBidModal}/bid`, {
        method: "POST", headers: jsonHeaders(),
        body: JSON.stringify({
          bid_amount: parseFloat(bidForm.bid_amount),
          cover_letter: bidForm.cover_letter
        })
      });
      if (res.ok) {
        alert("Bid submitted");
        setShowBidModal(null);
        setBidForm({ bid_amount: "", cover_letter: "" });
        fetchData();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to submit bid");
      }
    } catch { alert("Failed to submit bid"); }
    finally { setLoading(false); }
  };

  const loadBids = async (jobId: string) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      return;
    }
    setExpandedJobId(jobId);
    setBidsForJob([]);
    try {
      const res = await fetch(`${API_BASE}/api/v1/marketplace/jobs/${jobId}/bids`, { headers: authHeaders() });
      if (res.ok) setBidsForJob(await res.json());
    } catch (e) { console.error(e); }
  };

  const acceptBid = async (bidId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/marketplace/bids/${bidId}/accept`, { method: "POST", headers: authHeaders() });
      if (res.ok) {
        alert("Bid accepted! The job is now assigned.");
        fetchData();
        loadBids(expandedJobId!);
      }
    } catch { alert("Failed to accept bid"); }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-indigo-500" />
            Audit Marketplace
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Farm out tasks to verified freelance auditors, or pick up gigs.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowProfileModal(true)}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
            {profile ? "Edit Profile" : "Become a Freelancer"}
          </button>
          <button onClick={() => setShowJobModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            Post a Job
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <button onClick={() => setActiveTab("find_jobs")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "find_jobs" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}>
          Find Jobs
        </button>
        <button onClick={() => setActiveTab("my_jobs")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "my_jobs" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}>
          My Firm's Posted Jobs
        </button>
      </div>

      {/* Find Jobs Tab */}
      {activeTab === "find_jobs" && (
        <div className="space-y-4">
          {openJobs.filter((j: any) => j.org_id !== user?.org_id).length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
              No open jobs found.
            </div>
          ) : (
            openJobs.filter((j: any) => j.org_id !== user?.org_id).map((job: any) => (
              <div key={job.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-200 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">{job.title}</h3>
                    <p className="text-sm text-slate-500 mt-1">{job.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-indigo-600">${job.budget_amount}</p>
                    <p className="text-xs text-slate-400">{job.budget_type}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Posted {new Date(job.created_at).toLocaleDateString()}</span>
                  <button onClick={() => setShowBidModal(job.id)}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-md text-sm font-medium hover:bg-indigo-100 transition-colors">
                    Place Bid <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* My Jobs Tab */}
      {activeTab === "my_jobs" && (
        <div className="space-y-4">
          {myJobs.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
              Your firm hasn't posted any jobs yet.
            </div>
          ) : (
            myJobs.map((job: any) => (
              <div key={job.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-50" onClick={() => loadBids(job.id)}>
                  <div>
                    <h3 className="font-bold text-slate-900">{job.title}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Budget: ${job.budget_amount} | Status: <span className="font-medium text-slate-700">{job.status}</span></p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${job.bids_count > 0 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                      {job.bids_count} Bids
                    </span>
                    {expandedJobId === job.id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </div>

                {expandedJobId === job.id && (
                  <div className="p-5 bg-slate-50 border-t border-slate-100 space-y-3">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Bids Received</h4>
                    {bidsForJob.length === 0 ? (
                      <p className="text-sm text-slate-500">No bids yet.</p>
                    ) : (
                      bidsForJob.map((bid: any) => (
                        <div key={bid.id} className="bg-white border border-slate-200 p-4 rounded-lg flex justify-between items-start">
                          <div>
                            <p className="font-medium text-slate-900 text-sm">Freelancer ID: <span className="font-mono text-xs">{bid.freelancer_id.substring(0, 8)}</span></p>
                            <p className="text-sm text-slate-600 mt-2 italic">"{bid.cover_letter}"</p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="font-bold text-indigo-600">${bid.bid_amount}</p>
                            <span className="text-xs text-slate-400 block mb-2">{bid.status}</span>
                            {job.status === "Open" && bid.status === "Pending" && (
                              <button onClick={() => acceptBid(bid.id)}
                                className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700">
                                Accept
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Freelancer Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Specialties (comma separated)</label>
                <input value={profileForm.specialties} onChange={e => setProfileForm(p => ({ ...p, specialties: e.target.value }))}
                  placeholder="IT Audit, Tax, Startups" className="w-full border rounded-lg p-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Hourly Rate ($)</label>
                <input type="number" value={profileForm.hourly_rate} onChange={e => setProfileForm(p => ({ ...p, hourly_rate: e.target.value }))}
                  className="w-full border rounded-lg p-2 text-sm" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowProfileModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600">Cancel</button>
              <button onClick={saveProfile} disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Post Job Modal */}
      {showJobModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Post a Job</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Select Engagement</label>
                <select value={jobForm.engagement_id} onChange={e => setJobForm(p => ({ ...p, engagement_id: e.target.value }))}
                  className="w-full border rounded-lg p-2 text-sm">
                  {engagements.map(e => <option key={e.id} value={e.id}>{e.client_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Job Title</label>
                <input value={jobForm.title} onChange={e => setJobForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Conduct 50 ITGC Tests" className="w-full border rounded-lg p-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Description</label>
                <textarea rows={3} value={jobForm.description} onChange={e => setJobForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full border rounded-lg p-2 text-sm" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-slate-700 block mb-1">Budget Type</label>
                  <select value={jobForm.budget_type} onChange={e => setJobForm(p => ({ ...p, budget_type: e.target.value }))}
                    className="w-full border rounded-lg p-2 text-sm">
                    <option value="Fixed">Fixed Price</option>
                    <option value="Hourly">Hourly Rate</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-slate-700 block mb-1">Budget Amount ($)</label>
                  <input type="number" value={jobForm.budget_amount} onChange={e => setJobForm(p => ({ ...p, budget_amount: e.target.value }))}
                    className="w-full border rounded-lg p-2 text-sm" />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowJobModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600">Cancel</button>
              <button onClick={postJob} disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">Post Job</button>
            </div>
          </div>
        </div>
      )}

      {/* Bid Modal */}
      {showBidModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Place a Bid</h2>
            {!profile && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4 border border-red-100">
                You must create a Freelancer Profile first before bidding.
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Bid Amount ($)</label>
                <input type="number" value={bidForm.bid_amount} onChange={e => setBidForm(p => ({ ...p, bid_amount: e.target.value }))}
                  className="w-full border rounded-lg p-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Cover Letter</label>
                <textarea rows={4} value={bidForm.cover_letter} onChange={e => setBidForm(p => ({ ...p, cover_letter: e.target.value }))}
                  placeholder="Why are you a good fit?" className="w-full border rounded-lg p-2 text-sm" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowBidModal(null)} className="px-4 py-2 text-sm font-medium text-slate-600">Cancel</button>
              <button onClick={submitBid} disabled={loading || !profile} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">Submit Bid</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
