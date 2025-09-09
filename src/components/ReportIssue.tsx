import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, MapPin, AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Webcam from 'react-webcam';
import GoogleMapComponent from './GoogleMapComponent';
import axios from 'axios';

interface AIAnalysis {
  is_match: boolean;
  probability: number;
  severity?: 'low' | 'medium' | 'high';
}

type IssueType = 'drainage' | 'garbage_waste' | 'pothole';

// Create axios instance for AI model server with shorter timeout
const modelApi = axios.create({
  baseURL: 'http://localhost:5001',
  timeout: 10000, // 10 second timeout for real AI processing
});

const ReportIssue: React.FC = () => {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [issueType, setIssueType] = useState<IssueType>('drainage');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // AI Server connection state
  const [isModelServerOnline, setIsModelServerOnline] = useState<boolean | null>(null);
  const [isCheckingServer, setIsCheckingServer] = useState(true);

  // Check AI Model Server connection
  const checkModelServer = useCallback(async (retryCount = 0) => {
    const maxRetries = 2;
    
    try {
      console.log(`Checking AI Model Server... (attempt ${retryCount + 1})`);
      const response = await modelApi.get('/health');
      
      if (response.status === 200) {
        console.log('AI Model Server Online ✓');
        setIsModelServerOnline(true);
        setIsCheckingServer(false);
        return true;
      }
    } catch (error: any) {
      console.warn(`AI Model Server check failed (attempt ${retryCount + 1}):`, error.message);
      
      if (retryCount < maxRetries) {
        // Wait 2 seconds before retry
        setTimeout(() => checkModelServer(retryCount + 1), 2000);
        return;
      }
      
      console.log('AI Model Server Offline - Will show retry option');
      setIsModelServerOnline(false);
      setIsCheckingServer(false);
      return false;
    }
  }, []);

  // Retry server connection manually
  const retryServerConnection = useCallback(async () => {
    setIsCheckingServer(true);
    setIsModelServerOnline(null);
    await checkModelServer(0);
  }, [checkModelServer]);

  // Check server on component mount
  useEffect(() => {
    checkModelServer(0);
  }, [checkModelServer]);

  const analyzeImage = useCallback(async (imageData: File, category: IssueType) => {
    // Check if AI server is online first
    if (!isModelServerOnline) {
      toast.error('AI Model Server is offline. Please check connection and try again.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('image', imageData);
      formData.append('category', category);
      
      // Use the AI model server directly
      const response = await modelApi.post('/predict', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const result = response.data as AIAnalysis;
      setAiAnalysis(result);
      
      if (result.is_match) {
        toast.success(
          `Confirmed: This is a ${category} with ${(result.probability * 100).toFixed(1)}% confidence.`,
          { duration: 5000 }
        );
      } else {
        toast.error(
          `This does not appear to be a ${category} (${(result.probability * 100).toFixed(1)}% confidence).`,
          { duration: 5000 }
        );
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      
      if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
        toast.error('Cannot connect to AI Model Server. Please ensure it\'s running on port 5001.');
        setIsModelServerOnline(false);
      } else {
        toast.error(`Failed to analyze image: ${error.response?.data?.error || error.message || 'Unknown error'}`);
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [isModelServerOnline]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setAiAnalysis(null);
    }
  };

  const handleScan = () => {
    if (!isModelServerOnline) {
      toast.error('AI Model Server is offline. Please check connection and try again.');
      return;
    }
    
    if (image && issueType) {
      analyzeImage(image, issueType);
    } else {
      toast.error('Please upload or capture an image and select a category');
    }
  };

  const capture = useCallback(async () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setPreviewUrl(imageSrc);
        setShowCamera(false);
        const response = await fetch(imageSrc);
        const blob = await response.blob();
        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
        setImage(file);
        setAiAnalysis(null);
      } else {
        toast.error('Failed to capture image');
      }
    }
  }, []);

  const handleLocationSelect = useCallback(async (coords: { lat: number; lng: number }) => {
    setLocation(coords);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'CivicIssueReporter/1.0'
          }
        }
      );
      const data = await response.json();
      if (data && data.display_name) {
        setAddress(data.display_name);
      } else {
        setAddress('Address not found');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      toast.error('Failed to fetch address');
      setAddress('');
    }
  }, []);

  const handleSubmit = async () => {
    if (!image) {
      toast.error('Please upload or capture an image');
      return;
    }
    if (!location) {
      toast.error('Please select a location on the map');
      return;
    }
    if (!aiAnalysis) {
      toast.error('Please scan the image to confirm the issue');
      return;
    }
    if (!isModelServerOnline) {
      toast.error('AI Model Server is offline. Cannot submit report.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('image', image);
      formData.append('type', issueType);
      formData.append('latitude', location.lat.toString());
      formData.append('longitude', location.lng.toString());
      formData.append('address', address);
      formData.append('description', description);
      if (aiAnalysis.is_match) {
        formData.append('ai_probability', aiAnalysis.probability.toString());
        formData.append('ai_severity', aiAnalysis.severity || '');
      } else {
        formData.append('ai_probability', '0');
      }

      // Log form data for debugging
      for (let [key, value] of formData.entries()) {
        console.log(key, value);
      }

      // Submit to the AI model server (port 5001) instead of relative URL
      const response = await modelApi.post('/reports', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.status === 200 || response.status === 201) {
        toast.success('Report submitted successfully!');
        // Reset form after successful submission
        setImage(null);
        setPreviewUrl(null);
        setLocation(null);
        setAddress('');
        setDescription('');
        setAiAnalysis(null);
        // Navigate back to dashboard or reports page
        navigate('/dashboard');
      } else {
        throw new Error(`Server responded with status: ${response.status}`);
      }
    } catch (error: any) {
      console.error('Submit error:', error);
      
      if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
        toast.error('Cannot connect to AI Model Server. Please ensure it\'s running on port 5001.');
        setIsModelServerOnline(false);
      } else if (error.response) {
        // Server responded with an error
        const errorMessage = error.response.data?.error || error.response.data?.message || 'Server error occurred';
        toast.error(`Failed to submit report: ${errorMessage}`);
      } else {
        // Network or other error
        toast.error(`Failed to submit report: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="min-h-screen bg-black text-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-4 rounded-full shadow-lg">
              <Camera className="h-12 w-12 text-white" aria-hidden="true" />
            </div>
          </div>
          <h2 className="text-4xl font-bold text-purple-400 mb-4">Report an Issue</h2>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Select a category, capture or upload a photo, select location on map, and scan to confirm
          </p>
        </div>

        {/* AI Server Status */}
        <div className="mb-8">
          <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 backdrop-blur-md border border-purple-700/40 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {isCheckingServer ? (
                  <RefreshCw className="h-5 w-5 text-yellow-400 animate-spin mr-3" />
                ) : isModelServerOnline ? (
                  <Wifi className="h-5 w-5 text-green-400 mr-3" />
                ) : (
                  <WifiOff className="h-5 w-5 text-red-400 mr-3" />
                )}
                <span className="text-sm font-medium text-white">
                  AI Model Server: {isCheckingServer ? 'Checking...' : isModelServerOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              {!isModelServerOnline && !isCheckingServer && (
                <button
                  onClick={retryServerConnection}
                  className="text-xs px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Form Card */}
        <div className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20 backdrop-blur-md border border-purple-700/40 rounded-2xl shadow-xl p-8 space-y-8">
          
          {/* Issue Type Selection */}
          <div>
            <label htmlFor="issue-type" className="block text-sm font-medium text-purple-300 mb-3">
              Select Issue Type
            </label>
            <select
              id="issue-type"
              value={issueType}
              onChange={(e) => setIssueType(e.target.value as IssueType)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-purple-600/40 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
              aria-label="Select issue type"
            >
              <option value="drainage">Drainage Issues</option>
              <option value="garbage_waste">Garbage & Waste</option>
              <option value="pothole">Pothole Problems</option>
            </select>
          </div>

          {/* Image Capture/Upload Section */}
          <div className="space-y-6">
            <div className="flex justify-center space-x-4">
              <button
                type="button"
                onClick={() => setShowCamera(!showCamera)}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-purple-900/40"
                disabled={isAnalyzing || isSubmitting}
                aria-label={showCamera ? 'Hide camera' : 'Use camera'}
              >
                {showCamera ? 'Hide Camera' : 'Use Camera'}
                <Camera className="ml-2 h-5 w-5" aria-hidden="true" />
              </button>
              
              <label className="inline-flex items-center px-6 py-3 bg-purple-600/20 border border-purple-600/40 text-purple-300 font-medium rounded-lg hover:bg-purple-600/30 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200 shadow-lg">
                Upload Image
                <Upload className="ml-2 h-5 w-5" aria-hidden="true" />
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={isAnalyzing || isSubmitting}
                />
              </label>
            </div>

            {/* Camera View */}
            {showCamera && (
              <div className="relative rounded-2xl overflow-hidden border border-purple-600/40">
                <Webcam
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  className="w-full rounded-2xl"
                  videoConstraints={{ facingMode: 'environment' }}
                />
                <button
                  type="button"
                  onClick={capture}
                  className="absolute bottom-6 left-1/2 transform -translate-x-1/2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-full hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 shadow-lg transition-all duration-200"
                  aria-label="Capture photo"
                >
                  <Camera className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* Image Preview */}
            {previewUrl && !showCamera && (
              <div className="relative">
                <div className="rounded-2xl overflow-hidden border border-purple-600/40">
                  <img
                    src={previewUrl}
                    alt="Issue preview"
                    className="w-full h-80 object-cover"
                  />
                </div>
                
                {/* Scan Button */}
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={handleScan}
                    disabled={isAnalyzing || isSubmitting || !isModelServerOnline}
                    className={`inline-flex items-center px-8 py-4 font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200 shadow-lg ${
                      isAnalyzing || isSubmitting || !isModelServerOnline
                        ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                        : 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white hover:from-yellow-700 hover:to-orange-700 hover:shadow-yellow-900/40'
                    }`}
                    aria-label="Scan image"
                  >
                    {isAnalyzing ? 'Analyzing Image...' : 'Scan & Verify Image'}
                    {isAnalyzing ? (
                      <RefreshCw className="ml-3 h-5 w-5 animate-spin" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="ml-3 h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                </div>

                {/* AI Analysis Results */}
                {aiAnalysis && (
                  <div className="absolute top-4 right-4 bg-gradient-to-br from-purple-900/90 to-indigo-900/90 backdrop-blur-md border border-purple-600/40 rounded-2xl shadow-xl p-6 max-w-sm">
                    <h3 className="font-bold text-white mb-3 flex items-center">
                      <AlertTriangle className="h-5 w-5 mr-2 text-purple-400" />
                      AI Analysis: {issueType.replace('_', ' ')}
                    </h3>
                    {aiAnalysis.is_match ? (
                      aiAnalysis.probability >= 0.7 ? (
                        <div className="space-y-2">
                          <p className="text-green-300 font-medium">
                            ✅ Confirmed Match!
                          </p>
                          <p className="text-sm text-gray-300">
                            Confidence: {(aiAnalysis.probability * 100).toFixed(1)}%
                          </p>
                          {aiAnalysis.severity && (
                            <p className="text-sm text-gray-300">
                              Severity: <span className="capitalize text-purple-300">{aiAnalysis.severity}</span>
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-yellow-300 font-medium">
                            ⚠️ Possible Match
                          </p>
                          <p className="text-sm text-gray-300">
                            Image unclear ({(aiAnalysis.probability * 100).toFixed(1)}% confidence). Please upload a clearer photo.
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="space-y-2">
                        <p className="text-red-300 font-medium">
                          ❌ No Match Found
                        </p>
                        <p className="text-sm text-gray-300">
                          This doesn't appear to be a {issueType.replace('_', ' ')} ({(aiAnalysis.probability * 100).toFixed(1)}% confidence).
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Location Selection */}
          <div>
            <label className="block text-sm font-medium text-purple-300 mb-3">
              Select Location on Map
            </label>
            <div className="rounded-2xl overflow-hidden border border-purple-600/40">
              <GoogleMapComponent
                onLocationSelect={handleLocationSelect}
                initialLocation={location}
              />
            </div>
            {address && (
              <div className="mt-4 flex items-start p-4 bg-gray-800/30 rounded-lg border border-gray-600/30">
                <MapPin className="h-5 w-5 text-purple-400 mr-3 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-white mb-1">Selected Location:</p>
                  <p className="text-sm text-gray-300">{address}</p>
                </div>
              </div>
            )}
          </div>

          {/* Additional Details */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-purple-300 mb-3">
              Additional Details
            </label>
            <textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-purple-600/40 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none"
              placeholder="Provide any additional details about the issue (optional)"
              disabled={isSubmitting}
              aria-label="Issue description"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !image || !location || !aiAnalysis || !isModelServerOnline}
              className={`w-full flex justify-center items-center py-4 px-6 rounded-2xl shadow-lg text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200 ${
                isSubmitting || !image || !location || !aiAnalysis || !isModelServerOnline
                  ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 hover:shadow-green-900/40'
              }`}
              aria-label="Submit report"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-6 w-6 mr-3 animate-spin" />
                  Submitting Report...
                </>
              ) : (
                <>
                  <AlertTriangle className="h-6 w-6 mr-3" />
                  Submit Issue Report
                </>
              )}
            </button>
            
            {/* Form Status Indicators */}
            <div className="mt-4 flex justify-center space-x-6 text-sm">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${image ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                <span className={image ? 'text-green-400' : 'text-gray-400'}>Image</span>
              </div>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${location ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                <span className={location ? 'text-green-400' : 'text-gray-400'}>Location</span>
              </div>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${aiAnalysis ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                <span className={aiAnalysis ? 'text-green-400' : 'text-gray-400'}>AI Verification</span>
              </div>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${isModelServerOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className={isModelServerOnline ? 'text-green-400' : 'text-red-400'}>Server</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportIssue;