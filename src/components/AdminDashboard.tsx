import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Shield, LogOut } from 'lucide-react';

const AdminDashboard = () => {
  const navigate = useNavigate();

  const handleTrackComplaints = () => {
    navigate('/admin/track-complaints');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 text-white">
      {/* Header */}
      <header className="border-b border-purple-700/40 bg-black/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-purple-500" />
              <h1 className="text-2xl font-bold text-purple-400">CivicAI Admin</h1>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-red-600/20 hover:bg-red-600/40 rounded-md transition-colors duration-200 border border-red-600/40"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">
            Welcome to Admin Dashboard
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Manage and monitor civic issues reported by citizens. Use AI-powered analytics to prioritize and resolve urban infrastructure problems efficiently.
          </p>
        </div>

        {/* Dashboard Cards */}
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <div
              onClick={handleTrackComplaints}
              className="group relative bg-gradient-to-br from-purple-800/20 to-indigo-800/20 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-purple-700/40 hover:border-purple-500/60 transition-all duration-300 cursor-pointer transform hover:scale-105"
            >
              {/* Glow Effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></div>
              
              <div className="relative z-10 text-center">
                <div className="flex justify-center mb-6">
                  <div className="p-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full">
                    <FileText className="h-12 w-12 text-white" />
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-4">
                  Track Complaints
                </h3>
                
                <p className="text-gray-300 mb-6 leading-relaxed">
                  View, manage, and resolve citizen-reported issues. Monitor AI analysis results and update complaint statuses.
                </p>
                
                <div className="inline-flex items-center text-purple-400 font-medium group-hover:text-purple-300 transition-colors">
                  <span>Access Dashboard</span>
                  <svg className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-r from-green-800/20 to-emerald-800/20 backdrop-blur-md rounded-xl p-6 border border-green-700/40">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400 mb-2">24/7</div>
              <div className="text-green-300 text-sm">System Monitoring</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-blue-800/20 to-cyan-800/20 backdrop-blur-md rounded-xl p-6 border border-blue-700/40">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400 mb-2">AI</div>
              <div className="text-blue-300 text-sm">Powered Analytics</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-orange-800/20 to-red-800/20 backdrop-blur-md rounded-xl p-6 border border-orange-700/40">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-400 mb-2">Fast</div>
              <div className="text-orange-300 text-sm">Issue Resolution</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;