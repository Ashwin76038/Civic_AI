import { clearSession } from '../lib/session.mjs';
import { useState, useEffect } from 'react';
import { Camera, MapPin, AlertCircle, Clock, CheckCircle2, BarChart3, Users, Settings, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

type Report = {
  id: string;
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

  // Fetch account-scoped reports when the component mounts
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Read the same account-scoped API used by report submission and tracking.
        const response = await api.get('/complaints');
        const allReports = response.data;
        if (!Array.isArray(allReports)) throw new Error('Unexpected report response');
        setReports(allReports.slice(0, 3).map(report => ({
          id: report._id, type: report.type, status: report.status,
          location: report.location?.address || `${report.location?.latitude}, ${report.location?.longitude}`,
          date: report.submitted_at || report.created_at,
          imageUrl: report.imageUrl ? `${api.defaults.baseURL}${report.imageUrl}` : undefined,
        })));
        const total = allReports.length;
        const resolved = allReports.filter(report => report.status === 'Resolved').length;
        const inProgress = allReports.filter(report => report.status === 'In Progress').length;
        const responseRate = total ? ((resolved + inProgress) / total * 100) : 0;

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

  const handleLogout = async () => {
    try { await api.post('/logout'); }
    catch { setError('Server sign-out failed. Close this browser to clear its session cookie.'); return; }
    clearSession(localStorage);
    navigate('/login');
  };

  // Handle navigation based on selected tab
  const handleTabChange = (tab: string) => {
    setSelectedTab(tab);
    switch (tab) {
      case 'report':
        navigate('/report'); // Links to ReportIssue component
        break;
      case 'reports':
        navigate('/track-complaints');
        break;
      case 'community':
        navigate('/community');
        break;
      case 'settings':
        navigate('/settings');
        break;
      case 'overview':
      default:
        navigate('/dashboard');
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
        <button onClick={handleLogout} className="absolute bottom-8 w-full flex items-center px-6 py-3 text-sm text-red-600 hover:bg-red-50">
          <LogOut className="h-5 w-5 mr-3" />
          Sign Out
        </button>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome back, User!</h1>
          <p className="mt-2 text-gray-600">Latest 500 accessible reports at most; counts and shares cover this returned queue</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Reports in queue', value: stats.total, icon: AlertCircle },
            { label: 'Resolved', value: stats.resolved, icon: CheckCircle2 },
            { label: 'In Progress', value: stats.inProgress, icon: Clock },
            { label: 'In progress or resolved', value: `${stats.responseRate.toFixed(1)}%`, icon: BarChart3 },
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
                  src={report.imageUrl} // Fallback image
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
                        report.status === 'Resolved'
                          ? 'bg-green-100 text-green-800'
                          : report.status === 'In Progress'
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