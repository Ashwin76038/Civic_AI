import React, { useState, useEffect } from 'react';
import { Camera, MapPin, AlertCircle, Clock, CheckCircle2, BarChart3, Users, Settings, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase'; // Adjust the import path based on your project structure

type Report = {
  id: number;
  type: string;
  location: string;
  status: string;
  date: string;
  imageUrl?: string;
};

const Dashboard = () => {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    resolved: 0,
    inProgress: 0,
    responseRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Fetch data from Supabase when the component mounts
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch recent reports (limited to 3 for display)
        const { data: reportsData, error: reportsError } = await supabase
          .from('issues') // Assumes your table is named 'issues'
          .select('id, type, location, status, date, imageUrl')
          .order('date', { ascending: false })
          .limit(3);

        if (reportsError) throw reportsError;
        setReports(Array.isArray(reportsData) ? reportsData : []);

        // Fetch all reports for statistics
        const { data: allReports, error: allReportsError } = await supabase
          .from('issues')
          .select('status');

        if (allReportsError) throw allReportsError;

        const total = allReports.length;
        const resolved = allReports.filter((report) => report.status === 'resolved').length;
        const inProgress = allReports.filter((report) => report.status === 'in_progress').length;
        const responseRate = total > 0 ? ((resolved + inProgress) / total * 100).toFixed(1) : 0;

        setStats({
          total,
          resolved,
          inProgress,
          responseRate: Number(responseRate),
        });
      } catch (err) {
        setError('Failed to load data. Please try again later.');
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle navigation based on selected tab
  const handleTabChange = (tab: string) => {
    setSelectedTab(tab);
    switch (tab) {
      case 'report':
        navigate('/report'); // Links to ReportIssue component
        break;
      case 'reports':
        navigate('/my-reports');
        break;
      case 'community':
        navigate('/community');
        break;
      case 'settings':
        navigate('/settings');
        break;
      case 'overview':
      default:
        navigate('/');
    }
  };

  // Render loading or error states
  if (loading) {
    return <div className="text-center p-8">Loading...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-600">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-white shadow-lg">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-indigo-600">CivicAI</h2>
          <p className="text-sm text-gray-500">Issue Reporting System</p>
        </div>
        <nav className="mt-6">
          {[
            { name: 'Overview', icon: BarChart3, tab: 'overview' },
            { name: 'Report Issue', icon: Camera, tab: 'report' },
            { name: 'My Reports', icon: AlertCircle, tab: 'reports' },
            { name: 'Community', icon: Users, tab: 'community' },
            { name: 'Settings', icon: Settings, tab: 'settings' },
          ].map((item) => (
            <button
              key={item.tab}
              onClick={() => handleTabChange(item.tab)}
              className={`w-full flex items-center px-6 py-3 text-sm ${
                selectedTab === item.tab
                  ? 'text-indigo-600 bg-indigo-50 border-r-4 border-indigo-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <item.icon className="h-5 w-5 mr-3" />
              {item.name}
            </button>
          ))}
        </nav>
        <button className="absolute bottom-8 w-full flex items-center px-6 py-3 text-sm text-red-600 hover:bg-red-50">
          <LogOut className="h-5 w-5 mr-3" />
          Sign Out
        </button>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome back, User!</h1>
          <p className="mt-2 text-gray-600">Here's what's happening in your area</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Total Reports', value: stats.total, icon: AlertCircle },
            { label: 'Resolved', value: stats.resolved, icon: CheckCircle2 },
            { label: 'In Progress', value: stats.inProgress, icon: Clock },
            { label: 'Response Rate', value: `${stats.responseRate}%`, icon: BarChart3 },
          ].map((stat, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <stat.icon className="h-8 w-8 text-indigo-600" />
              </div>
            </div>
          ))}
        </div>

        {/* Recent Reports */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Reports</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.map((report) => (
              <div key={report.id} className="bg-gray-50 rounded-lg overflow-hidden">
                <img
                  src={report.imageUrl || 'https://via.placeholder.com/400x300'} // Fallback image
                  alt={report.type}
                  className="w-full h-48 object-cover"
                />
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900">{report.type}</h3>
                  <div className="flex items-center mt-2 text-sm text-gray-500">
                    <MapPin className="h-4 w-4 mr-1" />
                    {report.location}
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        report.status === 'resolved'
                          ? 'bg-green-100 text-green-800'
                          : report.status === 'in_progress'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {report.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-gray-500">{report.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;