import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Eye, Edit3, Trash2, MapPin, Calendar, AlertTriangle, Filter, Search, RefreshCw } from 'lucide-react';
import api from "../lib/api"; // Import the same API instance as TrackComplaints

interface Complaint {
  _id: string;
  title?: string;
  description?: string;
  status?: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  ai_probability?: number;
  ai_severity?: string;
  imageUrl?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  created_at?: string;
  updated_at?: string;
  type?: string;
}

interface AdminTrackComplaintsProps {
  onBack?: () => void;
}

const AdminTrackComplaints: React.FC<AdminTrackComplaintsProps> = ({ onBack }) => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    status: '',
    title: '',
    description: ''
  });
  
  // Filter and search states
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [severityFilter, setSeverityFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  
  // Add ref to track component mount status
  const isMountedRef = useRef(true);

  const statusColors = {
    'Open': 'bg-red-100 text-red-800',
    'In Progress': 'bg-yellow-100 text-yellow-800',
    'Resolved': 'bg-green-100 text-green-800',
    'Closed': 'bg-gray-100 text-gray-800'
  };

  const severityColors = {
    'Low': 'text-green-600',
    'Medium': 'text-yellow-600',
    'High': 'text-red-600',
    'Critical': 'text-red-700 font-bold'
  };

  // Fetch complaints using the same API approach as TrackComplaints
  const fetchComplaints = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log("🔄 Admin fetching complaints...");
      
      // Use the same API instance as TrackComplaints
      const response = await api.get("/complaints");
      const complaintsData = response.data;
      
      console.log("📋 Admin - Full axios response:", response);
      console.log("📊 Admin - Response.data:", response.data);
      console.log("📊 Admin - Response.data type:", typeof response.data);
      console.log("📊 Admin - Is response.data array?", Array.isArray(response.data));
      
      if (Array.isArray(complaintsData)) {
        console.log(`✅ Admin - Found ${complaintsData.length} complaints`);
        console.log("🔍 Admin - First complaint:", complaintsData[0]);
        setComplaints(complaintsData as Complaint[]);
        console.log("✅ Admin - Complaints state updated");
      } else if (complaintsData && typeof complaintsData === 'object') {
        // Handle nested response structures
        if ('complaints' in complaintsData && Array.isArray(complaintsData.complaints)) {
          console.log(`✅ Admin - Found ${complaintsData.complaints.length} complaints in nested structure`);
          setComplaints(complaintsData.complaints as Complaint[]);
        } else if ('data' in complaintsData && Array.isArray(complaintsData.data)) {
          console.log(`✅ Admin - Found ${complaintsData.data.length} complaints in data property`);
          setComplaints(complaintsData.data as Complaint[]);
        } else {
          console.warn("⚠️ Admin - Unexpected response structure:", complaintsData);
          console.warn("⚠️ Admin - Available properties:", Object.keys(complaintsData));
          setComplaints([]);
          setError("Unexpected data format received from server");
        }
      } else {
        console.warn("⚠️ Admin - Response data is not an array or object:", complaintsData);
        setComplaints([]);
        setError("Invalid data format received from server");
      }
      
    } catch (err: any) {
      console.error("❌ Admin - Error fetching complaints:", err);
      console.error("❌ Admin - Error stack:", err.stack);
      
      let errorMessage = "Failed to load complaints";
      
      if (err.response) {
        // Server responded with error status
        console.error("Admin - Server Error Response:", {
          status: err.response.status,
          data: err.response.data,
          headers: err.response.headers
        });
        
        errorMessage = err.response.data?.error || 
                      err.response.data?.message || 
                      `Server error (${err.response.status})`;
      } else if (err.request) {
        // Request made but no response
        console.error("Admin - Network Error - No Response:", err.request);
        errorMessage = "Cannot connect to server. Please check if the backend is running.";
      } else {
        // Something else happened
        console.error("Admin - Request Error:", err.message);
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setComplaints([]);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Delete complaint using API instance
  const deleteComplaint = useCallback(async (id: string) => {
    if (!isMountedRef.current) return;
    
    if (!window.confirm('Are you sure you want to delete this complaint? This action cannot be undone.')) {
      return;
    }

    try {
      console.log(`🗑️ Admin - Deleting complaint ${id}...`);
      await api.delete(`/complaints/${id}`);
      
      if (isMountedRef.current) {
        // Remove from local state
        setComplaints(complaints.filter(complaint => complaint._id !== id));
        
        if (selectedComplaint?._id === id) {
          setSelectedComplaint(null);
          setIsEditing(false);
        }
        
        console.log("✅ Admin - Complaint deleted successfully");
      }
    } catch (error: any) {
      if (!isMountedRef.current) return;
      
      console.error('❌ Admin - Error deleting complaint:', error);
      
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message;
      
      alert(`Failed to delete complaint: ${errorMessage}`);
    }
  }, [complaints, selectedComplaint]);

  // Update complaint using API instance
  const updateComplaint = useCallback(async () => {
    if (!selectedComplaint || !isMountedRef.current) return;

    try {
      console.log(`📝 Admin - Updating complaint ${selectedComplaint._id}...`);
      await api.patch(`/complaints/${selectedComplaint._id}`, editForm);

      if (isMountedRef.current) {
        // Update local state
        const updatedComplaints = complaints.map(complaint =>
          complaint._id === selectedComplaint._id
            ? { 
                ...complaint, 
                ...editForm, 
                status: editForm.status as Complaint['status'], 
                updated_at: new Date().toISOString() 
              }
            : complaint
        );
        
        setComplaints(updatedComplaints);
        setSelectedComplaint({ 
          ...selectedComplaint, 
          ...editForm, 
          status: editForm.status as Complaint['status'] 
        });
        setIsEditing(false);
        console.log("✅ Admin - Complaint updated successfully");
        alert('Complaint updated successfully!');
      }
    } catch (error: any) {
      if (!isMountedRef.current) return;
      
      console.error('❌ Admin - Error updating complaint:', error);
      
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message;
      
      alert(`Failed to update complaint: ${errorMessage}`);
    }
  }, [selectedComplaint, editForm, complaints]);

  // Get image URL using the same logic as TrackComplaints
  const getImageUrl = useCallback((imageUrl?: string) => {
    if (!imageUrl) return null;
    
    // If it's already a full URL, return as is
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      return imageUrl;
    }
    
    // If it starts with /, it's a relative path from our server
    if (imageUrl.startsWith("/")) {
      return `http://localhost:5000${imageUrl}`;
    }
    
    // Otherwise, assume it's just a filename in uploads
    return `http://localhost:5000/uploads/${imageUrl}`;
  }, []);

  // Filter complaints
  const filteredComplaints = complaints.filter(complaint => {
    const matchesStatus = statusFilter === 'All' || complaint.status === statusFilter;
    const matchesSeverity = severityFilter === 'All' || complaint.ai_severity === severityFilter;
    const matchesSearch = searchQuery === '' || 
      complaint.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      complaint.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      complaint.type?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesStatus && matchesSeverity && matchesSearch;
  });

  // Get statistics
  const stats = {
    total: complaints.length,
    open: complaints.filter(c => c.status === 'Open').length,
    inProgress: complaints.filter(c => c.status === 'In Progress').length,
    resolved: complaints.filter(c => c.status === 'Resolved').length,
    highPriority: complaints.filter(c => (c.ai_probability || 0) > 0.7).length
  };

  const handleRetry = useCallback(() => {
    console.log("🔄 Admin - Retry requested");
    setRetryCount(prev => prev + 1);
    fetchComplaints();
  }, [fetchComplaints]);

  useEffect(() => {
    console.log("🚀 Admin - Component mounted, fetching complaints...");
    fetchComplaints();
    
    return () => {
      console.log("🔄 Admin - Component unmounting");
      isMountedRef.current = false;
    };
  }, [fetchComplaints]);

  // Debug effect to log state changes
  useEffect(() => {
    console.log("📈 Admin - State update:", { 
      loading, 
      error, 
      complaintsCount: complaints.length,
      complaints: complaints.length > 0 ? complaints.slice(0, 2) : "none"
    });
  }, [loading, error, complaints]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mb-4 mx-auto" />
          <div className="text-white text-xl">Loading complaints...</div>
          {retryCount > 0 && (
            <p className="text-white/60 text-sm mt-2">Retry attempt #{retryCount}</p>
          )}
          <p className="text-white/40 text-xs mt-4">Check console for debug info</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-8">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-400 mb-4 mx-auto" />
          <h2 className="text-2xl font-bold text-red-400 mb-4">Error Loading Complaints</h2>
          <div className="bg-red-900/20 border border-red-500/40 rounded-lg p-4 max-w-md">
            <p className="text-red-300 mb-4">{error}</p>
            <div className="space-y-2">
              <button
                onClick={handleRetry}
                className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </button>
              <p className="text-gray-400 text-sm">
                Make sure the backend server is running on port 5000
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            <div>
              <h1 className="text-3xl font-bold text-white">Admin - Track Complaints</h1>
              <p className="text-white/70 mt-1">Manage and resolve citizen-reported issues</p>
            </div>
          </div>
          
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2 inline" />
            Refresh
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-white">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm opacity-70">Total Complaints</div>
          </div>
          <div className="bg-red-500/20 backdrop-blur-sm rounded-lg p-4 text-white">
            <div className="text-2xl font-bold">{stats.open}</div>
            <div className="text-sm opacity-70">Open</div>
          </div>
          <div className="bg-yellow-500/20 backdrop-blur-sm rounded-lg p-4 text-white">
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <div className="text-sm opacity-70">In Progress</div>
          </div>
          <div className="bg-green-500/20 backdrop-blur-sm rounded-lg p-4 text-white">
            <div className="text-2xl font-bold">{stats.resolved}</div>
            <div className="text-sm opacity-70">Resolved</div>
          </div>
          <div className="bg-orange-500/20 backdrop-blur-sm rounded-lg p-4 text-white">
            <div className="text-2xl font-bold">{stats.highPriority}</div>
            <div className="text-sm opacity-70">High Priority</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center space-x-2">
              <Search className="w-5 h-5 text-white" />
              <input
                type="text"
                placeholder="Search complaints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-white" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="All">All Status</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="All">All Severity</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>

        {/* Show same "no complaints" message as TrackComplaints */}
        {!complaints.length ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-400 mb-4">No Complaints Found</h2>
            <p className="text-gray-500 mb-6">
              There are currently no complaints in the system.
            </p>
            <button
              onClick={handleRetry}
              className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Complaints List */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-4">
                Complaints ({filteredComplaints.length})
              </h2>
              
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {filteredComplaints.length === 0 ? (
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 text-center text-white">
                    <AlertTriangle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No complaints match your filters</p>
                    <p className="text-sm opacity-70 mt-2">Try adjusting your filters or search query</p>
                  </div>
                ) : (
                  filteredComplaints.map((complaint) => {
                    return (
                      <div
                        key={complaint._id}
                        className={`bg-white/10 backdrop-blur-sm rounded-lg p-4 cursor-pointer transition-all hover:bg-white/20 ${
                          selectedComplaint?._id === complaint._id ? 'ring-2 ring-blue-400' : ''
                        }`}
                        onClick={() => {
                          setSelectedComplaint(complaint);
                          setIsEditing(false);
                          setEditForm({
                            status: complaint.status || 'Open',
                            title: complaint.title || '',
                            description: complaint.description || ''
                          });
                        }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold text-white truncate flex-1">
                            {complaint.title || `Complaint ${filteredComplaints.indexOf(complaint) + 1}`}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ml-2 ${statusColors[complaint.status || 'Open']}`}>
                            {complaint.status || 'Open'}
                          </span>
                        </div>
                        
                        <p className="text-white/70 text-sm mb-3 line-clamp-2">
                          {complaint.description || 'No description provided'}
                        </p>
                        
                        <div className="flex items-center justify-between text-xs text-white/60">
                          <div className="flex items-center space-x-4">
                            <span className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              {new Date(complaint.created_at || '').toLocaleDateString()}
                            </span>
                            {complaint.ai_severity && (
                              <span className={`font-medium ${severityColors[complaint.ai_severity as keyof typeof severityColors] || 'text-gray-400'}`}>
                                {complaint.ai_severity} Priority
                              </span>
                            )}
                          </div>
                          {complaint.ai_probability !== undefined && complaint.ai_probability > 0 && (
                            <div className="text-white/40">
                              AI: {Math.round(complaint.ai_probability * 100)}%
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Complaint Details */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              {selectedComplaint ? (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-white">Complaint Details</h2>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setIsEditing(!isEditing);
                          if (!isEditing) {
                            setEditForm({
                              status: selectedComplaint.status || 'Open',
                              title: selectedComplaint.title || '',
                              description: selectedComplaint.description || ''
                            });
                          }
                        }}
                        className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteComplaint(selectedComplaint._id)}
                        className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-white/70 text-sm mb-2">Status</label>
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-white/70 text-sm mb-2">Title</label>
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>

                      <div>
                        <label className="block text-white/70 text-sm mb-2">Description</label>
                        <textarea
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          rows={4}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                        />
                      </div>

                      <div className="flex space-x-3">
                        <button
                          onClick={updateComplaint}
                          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => setIsEditing(false)}
                          className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold text-white mb-2">
                          {selectedComplaint.title || 'Untitled Complaint'}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[selectedComplaint.status || 'Open']}`}>
                          {selectedComplaint.status || 'Open'}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-white/70 text-sm mb-1">Description</h4>
                        <p className="text-white">{selectedComplaint.description || 'No description provided'}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-white/70 text-sm mb-1">Type</h4>
                          <p className="text-white capitalize">{selectedComplaint.type?.replace('_', ' ') || 'N/A'}</p>
                        </div>
                        <div>
                          <h4 className="text-white/70 text-sm mb-1">Severity</h4>
                          <p className={`font-medium ${severityColors[selectedComplaint.ai_severity as keyof typeof severityColors] || 'text-gray-400'}`}>
                            {selectedComplaint.ai_severity || 'Not analyzed'}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-white/70 text-sm mb-1">AI Confidence</h4>
                          <p className="text-white">
                            {selectedComplaint.ai_probability !== undefined && selectedComplaint.ai_probability > 0 
                              ? `${Math.round(selectedComplaint.ai_probability * 100)}%`
                              : 'N/A'
                            }
                          </p>
                        </div>
                        <div>
                          <h4 className="text-white/70 text-sm mb-1">Created</h4>
                          <p className="text-white">{new Date(selectedComplaint.created_at || '').toLocaleDateString()}</p>
                        </div>
                      </div>

                      {getImageUrl(selectedComplaint.imageUrl) && (
                        <div>
                          <h4 className="text-white/70 text-sm mb-2">Image</h4>
                          <img
                            src={getImageUrl(selectedComplaint.imageUrl)!}
                            alt="Complaint"
                            className="w-full h-48 object-cover rounded-lg"
                            onError={(e) => {
                              console.error("Admin - Image failed to load:", getImageUrl(selectedComplaint.imageUrl));
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      )}

                      {selectedComplaint.location && (selectedComplaint.location.latitude || selectedComplaint.location.longitude || selectedComplaint.location.address) && (
                        <div>
                          <h4 className="text-white/70 text-sm mb-2">Location</h4>
                          {selectedComplaint.location.address && (
                            <div className="flex items-start text-white mb-2">
                              <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                              <span>{selectedComplaint.location.address}</span>
                            </div>
                          )}
                          {selectedComplaint.location.latitude && selectedComplaint.location.longitude && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-white/60">
                                {selectedComplaint.location.latitude.toFixed(6)}, {selectedComplaint.location.longitude.toFixed(6)}
                              </span>
                              <a
                                href={`https://www.google.com/maps?q=${selectedComplaint.location.latitude},${selectedComplaint.location.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-400 hover:text-purple-300 text-xs underline"
                              >
                                View on Maps
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-white/50 py-12">
                  <Eye className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">Select a complaint to view details</p>
                  <p className="text-sm mt-2">Click on any complaint from the list to manage it</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTrackComplaints;