import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus, ArrowRight, MapPin } from "lucide-react";
import api from "../lib/api"; // Import centralized API config

const SignUp = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    location: "",
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      // Send signup request to the server
      const response = await api.post("/signup", {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        location: formData.location,
        role: "user", // Set default role to user
      });

      const data = response.data as { success: boolean; message?: string };
      if (data.success) {
        navigate("/login"); // Redirect to login on successful signup
      } else {
        setError(data.message || "Signup failed. Please try again.");
      }
    } catch (err) {
      setError("Signup failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex bg-black text-white">
      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-8 py-12">
        <div className="max-w-md w-full space-y-8 bg-gradient-to-br from-purple-900/20 to-indigo-900/20 backdrop-blur-md p-8 rounded-2xl shadow-xl border border-purple-700/40">
          <div className="text-center">
            <div className="flex justify-center">
              <UserPlus className="h-12 w-12 text-purple-400" />
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-purple-300">
              Join CivicAI
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Help make your city better through community reporting
            </p>
          </div>

          {/* Form */}
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Full Name */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-300"
                >
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="mt-1 block w-full px-3 py-2 bg-black border border-purple-700/40 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-300"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="mt-1 block w-full px-3 py-2 bg-black border border-purple-700/40 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>

              {/* Location */}
              <div>
                <label
                  htmlFor="location"
                  className="block text-sm font-medium text-gray-300"
                >
                  Your Neighborhood
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-purple-400" />
                  </div>
                  <input
                    id="location"
                    name="location"
                    type="text"
                    required
                    className="block w-full pl-10 px-3 py-2 bg-black border border-purple-700/40 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500"
                    placeholder="Enter your area"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-300"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="mt-1 block w-full px-3 py-2 bg-black border border-purple-700/40 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-300"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  className="mt-1 block w-full px-3 py-2 bg-black border border-purple-700/40 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      confirmPassword: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-900/30 border border-red-600/40 rounded-md">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-3 px-4 rounded-md text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 shadow-lg shadow-purple-900/40"
              >
                Create Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </form>

          {/* Sign in link */}
          <div className="text-center">
            <p className="text-sm text-gray-400">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-medium text-purple-400 hover:text-purple-300"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Image */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-indigo-900 opacity-80"></div>
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80"
          alt="Smart city"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="max-w-2xl p-8 text-white">
            <h2 className="text-4xl font-bold mb-4">
              Smart City, Smarter Solutions
            </h2>
            <p className="text-lg text-gray-200">
              Join our community of active citizens using AI technology to
              identify and report infrastructure issues. Together, we can create
              a more responsive and efficient urban environment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
