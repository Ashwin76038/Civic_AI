import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Camera } from 'lucide-react';
import api from '../lib/api'; // Import centralized API config

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // Define the expected response data type
      type LoginResponse = {
        success: boolean;
        token: string;
        role: string;
        message?: string;
      };

      // Send login request to the server
      const response = await api.post('/login', formData);

      const data = response.data as LoginResponse;

      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role); // Store user role

        // Redirect based on role
        if (data.role === 'admin') {
          navigate('/admin/dashboard'); // Changed to dashboard first
        } else {
          navigate('/track-complaints');
        }
      } else {
        setError(data.message || 'Invalid credentials');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex bg-black text-white">
      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-8 py-12">
        <div className="max-w-md w-full space-y-8 bg-gradient-to-br from-purple-800/20 to-indigo-800/20 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-purple-700/40">
          <div className="text-center">
            <div className="flex justify-center">
              <Camera className="h-12 w-12 text-purple-500" />
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-purple-400">Welcome to CivicAI</h2>
            <p className="mt-2 text-sm text-gray-400">
              AI-Powered Civic Issue Reporting System
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="mt-1 block w-full px-3 py-2 rounded-md bg-black border border-purple-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="mt-1 block w-full px-3 py-2 rounded-md bg-black border border-purple-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-900/30 border border-red-600/40 rounded-md">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 text-sm font-medium rounded-md text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                Sign in
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </form>

          <div className="space-y-2 text-center">
            <p className="text-sm text-gray-400">
              Don't have an account?{' '}
              <Link to="/signup" className="font-medium text-purple-400 hover:text-purple-300">
                Sign up
              </Link>
            </p>
            <p className="text-sm text-gray-400">
              Are you an admin?{' '}
              <Link to="/admin" className="font-medium text-purple-400 hover:text-purple-300">
                Admin login
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Glow Effect */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-black to-indigo-900 opacity-70"></div>
        <div className="relative z-10 text-center max-w-lg p-6">
          <h2 className="text-4xl font-bold text-purple-400 mb-4">Make Your City Smarter & Safer</h2>
          <p className="text-lg text-gray-300">
            Report infrastructure issues instantly with our AI-powered system. 
            We use computer vision to analyze and prioritize repairs, ensuring faster resolution for a safer, more efficient city.
          </p>
        </div>
        <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600 blur-3xl opacity-30 animate-pulse"></div>
      </div>
    </div>
  );
};

export default Login;