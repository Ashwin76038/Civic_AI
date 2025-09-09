import React, { useEffect, useState, useRef, useCallback } from "react";
import { Trash2, RefreshCw, AlertCircle, MapPin, Calendar, Tag } from "lucide-react";
import api from "../lib/api";

interface Complaint {
  _id: string;
  title?: string;
  description?: string;
  status?: string;
  imageUrl?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  created_at?: string;
  updated_at?: string;
  type?: string;
  ai_probability?: number;
  ai_severity?: string;
}

const statusColors: Record<string, string> = {
  Open: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40",
  "In Progress": "bg-blue-500/20 text-blue-300 border border-blue-500/40",
  Resolved: "bg-green-500/20 text-green-300 border border-green-500/40",
  Closed: "bg-gray-500/20 text-gray-300 border border-gray-500/40",
};

const TrackComplaints: React.FC = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const isMountedRef = useRef(true);

  // Enhanced response parser for all possible Flask response formats
  const parseComplaintsResponse = useCallback((responseData: any): Complaint[] => {
    console.log("🔍 PARSING RESPONSE:", responseData);
    console.log("🔍 Response type:", typeof responseData);
    console.log("🔍 Response keys:", responseData ? Object.keys(responseData) : "No keys");

    // Handle null/undefined
    if (!responseData) {
      console.log("❌ Response data is null/undefined");
      return [];
    }

    // Direct array (Flask might return direct array)
    if (Array.isArray(responseData)) {
      console.log(`✅ Format: Direct array with ${responseData.length} items`);
      return responseData as Complaint[];
    }

    // Object with various possible keys (common Flask patterns)
    if (responseData && typeof responseData === "object") {
      
      // Try common Flask response patterns
      const possibleKeys = [
        'complaints', 'data', 'results', 'items', 'records', 
        'complaint', 'list', 'content', 'payload', 'response'
      ];
      
      for (const key of possibleKeys) {
        if (responseData[key] && Array.isArray(responseData[key])) {
          console.log(`✅ Format: Wrapped in '${key}' property with ${responseData[key].length} items`);
          return responseData[key] as Complaint[];
        }
      }

      // Check for nested structures (Flask often uses nested responses)
      if (responseData.data && typeof responseData.data === "object") {
        for (const key of possibleKeys) {
          if (responseData.data[key] && Array.isArray(responseData.data[key])) {
            console.log(`✅ Format: Nested in data.${key} with ${responseData.data[key].length} items`);
            return responseData.data[key] as Complaint[];
          }
        }
        
        // Check if data itself is an array
        if (Array.isArray(responseData.data)) {
          console.log(`✅ Format: Array in data property with ${responseData.data.length} items`);
          return responseData.data as Complaint[];
        }
      }

      // Check for Flask-SQLAlchemy pagination format
      if (responseData.items && Array.isArray(responseData.items)) {
        console.log(`✅ Format: Pagination format with ${responseData.items.length} items`);
        return responseData.items as Complaint[];
      }

      // Check for success wrapper (common Flask pattern)
      if (responseData.success && responseData.data) {
        if (Array.isArray(responseData.data)) {
          console.log(`✅ Format: Success wrapper with array (${responseData.data.length} items)`);
          return responseData.data as Complaint[];
        }
      }

      // Check if the object itself contains complaint-like properties (single complaint)
      if (responseData._id || responseData.id || responseData.title || responseData.description) {
        console.log("✅ Format: Single complaint object, wrapping in array");
        return [responseData as Complaint];
      }

      // Log all available properties for debugging
      console.log("❌ Unknown response format");
      console.log("🔍 Available properties:", Object.keys(responseData));
      console.log("🔍 Sample values:", Object.entries(responseData).slice(0, 3));
    }

    console.log("❌ Could not parse response into complaints array");
    return [];
  }, []);

  const fetchComplaints = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log("🔄 Fetching complaints...");
      
      const response = await api.get("/complaints");
      
      console.log("📡 Full axios response:", response);
      console.log("📡 Response status:", response.status);
      console.log("📡 Response data:", response.data);
      console.log("📡 Response data type:", typeof response.data);
      
      if (!isMountedRef.current) return;

      // Use enhanced parser
      const complaintsData = parseComplaintsResponse(response.data);
      
      console.log("📊 FINAL PARSED COMPLAINTS:", complaintsData);
      console.log("📊 Complaints count:", complaintsData.length);
      
      if (complaintsData.length > 0) {
        console.log("📋 First complaint sample:", complaintsData[0]);
        console.log("📋 Complaint properties:", Object.keys(complaintsData[0] || {}));
      } else {
        console.log("⚠️ No complaints found after parsing");
        console.log("⚠️ Raw response was:", JSON.stringify(response.data, null, 2));
      }

      setComplaints(complaintsData);
      console.log("✅ Complaints state updated with", complaintsData.length, "items");
      
    } catch (err: any) {
      console.error("❌ Error fetching complaints:", err);
      console.error("❌ Error details:", {
        message: err.message,
        response: err.response,
        status: err.response?.status,
        data: err.response?.data
      });
      
      if (!isMountedRef.current) return;
      
      let errorMessage = "Failed to load complaints";
      
      if (err.response) {
        console.error("Server Error Response:", {
          status: err.response.status,
          data: err.response.data,
          headers: err.response.headers
        });
        
        errorMessage = err.response.data?.error || 
                      err.response.data?.message || 
                      `Server error (${err.response.status})`;
      } else if (err.request) {
        console.error("Network Error - No Response:", err.request);
        errorMessage = "Cannot connect to server. Please check if the backend is running on port 5000.";
      } else {
        console.error("Request Error:", err.message);
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setComplaints([]);
    } finally {
      if (isMountedRef.current) {
        console.log("🏁 Setting loading to false");
        setLoading(false);
      }
    }
  }, [parseComplaintsResponse]);

  useEffect(() => {
    console.log("🚀 Component mounted, starting initial fetch...");
    fetchComplaints();
    
    return () => {
      console.log("🔄 Component unmounting");
      isMountedRef.current = false;
    };
  }, [fetchComplaints]);

  // Debug effect to log state changes
  useEffect(() => {
    console.log("📈 State update:", { 
      loading, 
      error, 
      complaintsCount: complaints.length,
      hasComplaints: complaints.length > 0,
      firstComplaint: complaints.length > 0 ? complaints[0]._id : "none"
    });
  }, [loading, error, complaints]);

  const handleRetry = useCallback(() => {
    console.log("🔄 Manual retry requested");
    setRetryCount(prev => prev + 1);
    fetchComplaints();
  }, [fetchComplaints]);

  const handleDelete = useCallback(async (id: string) => {
    if (!isMountedRef.current) return;
    
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this complaint?"
    );
    if (!confirmDelete) return;

    try {
      console.log(`🗑️ Deleting complaint ${id}...`);
      await api.delete(`/complaints/${id}`);
      
      if (isMountedRef.current) {
        setComplaints((prev) => prev.filter((c) => c._id !== id));
        console.log("✅ Complaint deleted successfully");
      }
      
    } catch (error: any) {
      if (!isMountedRef.current) return;
      
      console.error("❌ Error deleting complaint:", error);
      
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message;
      
      alert(`Failed to delete complaint: ${errorMessage}`);
    }
  }, []);

  const formatDate = useCallback((dateString?: string) => {
    if (!dateString) return "N/A";
    
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Invalid date";
    }
  }, []);

  const getImageUrl = useCallback((imageUrl?: string) => {
    if (!imageUrl) return null;
    
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      return imageUrl;
    }
    
    if (imageUrl.startsWith("/")) {
      return `http://localhost:5000${imageUrl}`;
    }
    
    return `http://localhost:5000/uploads/${imageUrl}`;
  }, []);

  console.log("🎨 Rendering component - Loading:", loading, "Error:", !!error, "Complaints:", complaints.length);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <RefreshCw className="h-8 w-8 text-purple-400 animate-spin mb-4" />
        <p className="text-gray-400 text-lg">Loading complaints...</p>
        {retryCount > 0 && (
          <p className="text-gray-500 text-sm mt-2">Retry attempt #{retryCount}</p>
        )}
        <div className="mt-4 text-center">
          <p className="text-gray-500 text-xs">Fetching from backend...</p>
          <p className="text-gray-500 text-xs">Check console for detailed logs</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
        <AlertCircle className="h-16 w-16 text-red-400 mb-4" />
        <h2 className="text-2xl font-bold text-red-400 mb-4">Error Loading Complaints</h2>
        <div className="bg-red-900/20 border border-red-500/40 rounded-lg p-4 max-w-md text-center">
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
              Make sure the Flask backend is running on port 5000
            </p>
            <p className="text-gray-500 text-xs">
              Check browser console and network tab for details
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!complaints.length) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-400 mb-4">No Complaints Found</h2>
          <p className="text-gray-500 mb-6">
            The database appears to be empty or the response format is unexpected.
          </p>
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
            <div className="text-sm text-gray-500 space-y-1">
              <p>If complaints exist in your database:</p>
              <p>• Check browser console for parsing errors</p>
              <p>• Verify Flask backend response format</p>
              <p>• Ensure database connection is working</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-purple-400 mb-2">
            Track Complaints
          </h2>
          <p className="text-gray-400">
            Found {complaints.length} complaint{complaints.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={handleRetry}
          className="inline-flex items-center px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-600/40 rounded-lg transition-colors"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Complaints Grid */}
      <div className="grid gap-8 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {complaints.map((complaint, index) => {
          const statusClass =
            statusColors[complaint.status || "Open"] ||
            "bg-gray-500/20 text-gray-300 border border-gray-500/40";

          const imageUrl = getImageUrl(complaint.imageUrl);

          return (
            <div
              key={complaint._id}
              className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-purple-700/40 hover:scale-105 hover:shadow-purple-900/40 transition-all duration-300"
            >
              {/* Complaint Image */}
              {imageUrl && (
                <div className="relative mb-4">
                  <img
                    src={imageUrl}
                    alt={`Complaint ${index + 1}`}
                    className="w-full h-48 object-cover rounded-lg"
                    onError={(e) => {
                      console.error("Image failed to load:", imageUrl);
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Header with Title, Status, and Delete */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white mb-1">
                    {complaint.title || `Complaint ${index + 1}`}
                  </h3>
                  {complaint.type && (
                    <div className="flex items-center text-sm text-gray-400 mb-2">
                      <Tag className="h-4 w-4 mr-1" />
                      {complaint.type.replace("_", " ").toLowerCase()}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span
                    className={`px-3 py-1 text-sm font-medium rounded-full ${statusClass}`}
                  >
                    {complaint.status || "Open"}
                  </span>
                  <button
                    onClick={() => handleDelete(complaint._id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                    title="Delete complaint"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* AI Analysis Info */}
              {complaint.ai_probability !== undefined && complaint.ai_probability > 0 && (
                <div className="bg-purple-900/30 border border-purple-700/40 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-purple-300 font-medium">AI Analysis</span>
                    <span className={`font-semibold ${
                      complaint.ai_probability >= 0.8 ? 'text-green-400' :
                      complaint.ai_probability >= 0.6 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {(complaint.ai_probability * 100).toFixed(1)}% confidence
                    </span>
                  </div>
                  {complaint.ai_severity && (
                    <div className="text-xs text-gray-300 mt-1">
                      Severity: {complaint.ai_severity}
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <div className="mb-4">
                <p className="text-gray-300 text-base leading-relaxed">
                  {complaint.description || "No description provided"}
                </p>
              </div>

              {/* Location Information */}
              <div className="mb-4">
                {complaint.location && 
                 (complaint.location.latitude || complaint.location.longitude || complaint.location.address) ? (
                  <div className="text-sm text-gray-400 space-y-2">
                    {complaint.location.address && (
                      <div className="flex items-start">
                        <MapPin className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                        <span>{complaint.location.address}</span>
                      </div>
                    )}
                    {complaint.location.latitude && complaint.location.longitude && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {complaint.location.latitude.toFixed(6)}, {complaint.location.longitude.toFixed(6)}
                        </span>
                        <a
                          href={`https://www.google.com/maps?q=${complaint.location.latitude},${complaint.location.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300 text-xs underline"
                        >
                          View on Maps
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 flex items-center">
                    <MapPin className="h-4 w-4 mr-1" />
                    No location data
                  </p>
                )}
              </div>

              {/* Timestamps */}
              <div className="border-t border-gray-700/50 pt-3">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    Created: {formatDate(complaint.created_at)}
                  </div>
                  {complaint.updated_at && complaint.updated_at !== complaint.created_at && (
                    <div>
                      Updated: {formatDate(complaint.updated_at)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrackComplaints;