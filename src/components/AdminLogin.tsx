import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Settings, Loader2 } from "lucide-react";
import api from "../lib/api"; // ✅ Import central API config

const AdminLogin = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      console.log("🔐 Attempting admin login...", formData.email);

      // ✅ Use centralized API (baseURL already handled in api.ts)
      const response = await api.post("/login", {
        email: formData.email,
        password: formData.password,
      });

      const data = response.data as {
        user?: { role?: string; [key: string]: any };
        token?: string;
        error?: string;
        [key: string]: any;
      };

      console.log("📡 Login response:", data);

      if (response.status === 200 && data.user) {
        if (data.user.role === "admin") {
          console.log("✅ Admin login successful!");

          // ✅ Store admin info in localStorage
          localStorage.setItem("isAdmin", "true");
          if (data.token) localStorage.setItem("adminToken", data.token);
          localStorage.setItem("adminUser", JSON.stringify(data.user));

          navigate("/admin/dashboard");
        } else {
          setError("Access denied. Admin privileges required.");
        }
      } else {
        setError(data.error || "Invalid admin credentials");
      }
    } catch (err) {
      console.error("❌ Login error:", err);
      setError("Failed to connect to server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-black text-white">
      {/* Left Side */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-black to-indigo-900 opacity-80"></div>
        <div className="relative z-10 text-center max-w-xl p-6">
          <h2 className="text-4xl font-bold text-purple-400 mb-4">
            Administrative Control Center
          </h2>
          <p className="text-lg text-gray-300">
            Access advanced AI analytics, manage reported issues, and coordinate
            with municipal departments for efficient resolution of urban
            infrastructure problems.
          </p>

          <div className="mt-8 p-4 bg-purple-900/30 rounded-lg border border-purple-600/40">
            <p className="text-sm text-purple-300 mb-2">🔐 Test Credentials:</p>
            <p className="text-xs text-gray-400">Email: admin@gmail.com</p>
            <p className="text-xs text-gray-400">Password: admin123</p>
          </div>
        </div>
        <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600 blur-3xl opacity-30 animate-pulse"></div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-8 py-12">
        <div className="max-w-md w-full space-y-8 bg-gradient-to-br from-purple-800/20 to-indigo-800/20 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-purple-700/40">
          <div className="text-center">
            <div className="flex justify-center">
              <Shield className="h-12 w-12 text-purple-500" />
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-purple-400">
              Admin Portal
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Access the administrative dashboard
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-300"
                >
                  Admin Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  disabled={isLoading}
                  className="mt-1 block w-full px-3 py-2 rounded-md bg-black border border-purple-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="Enter admin email"
                />
              </div>
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
                  disabled={isLoading}
                  className="mt-1 block w-full px-3 py-2 rounded-md bg-black border border-purple-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Enter password"
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
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 text-sm font-medium rounded-md text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    Access Admin Dashboard
                    <Settings className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="text-center">
            <Link
              to="/login"
              className="font-medium text-purple-400 hover:text-purple-300 text-sm"
            >
              Back to user login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
