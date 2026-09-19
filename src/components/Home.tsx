import { Link } from 'react-router-dom';
import { Camera, Shield, Activity, Clock } from 'lucide-react';

// ✅ Import video from assets
import heroVideo from '../assets/asset-63e44766.mp4';

const Home = () => {
  const features = [
    {
      id: 'ai-detection',
      icon: Camera,
      title: 'AI-Powered Detection',
      description: 'Automatically detect urban infrastructure issues using computer vision.'
    },
    {
      id: 'secure-reporting',
      icon: Shield,
      title: 'Secure Reporting',
      description: 'Your reports are encrypted and securely transmitted to municipal authorities.'
    },
    {
      id: 'real-time-updates',
      icon: Activity,
      title: 'Real-time Updates',
      description: 'Track the status of your complaints with our real-time notification system.'
    },
    {
      id: 'quick-resolution',
      icon: Clock,
      title: 'Quick Resolution',
      description: 'Automated escalation ensures timely resolution of reported issues.'
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="bg-black shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Camera className="h-8 w-8 text-purple-400" />
              <span className="ml-2 text-2xl font-bold text-white">CivicAI</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-medium text-purple-400 hover:text-purple-300"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative bg-black overflow-hidden min-h-screen lg:min-h-0">
        <div className="lg:grid lg:grid-cols-2 lg:gap-0">
          {/* Left Content */}
          <div className="px-4 py-10 sm:px-6 sm:py-16 lg:px-8 lg:py-24 flex items-center bg-black">
            <div className="max-w-xl mx-auto lg:mx-0">
              <h1 className="text-4xl tracking-tight font-extrabold text-white sm:text-5xl md:text-6xl">
                <span className="block">Make your city</span>
                <span className="block text-purple-400">smarter and safer</span>
              </h1>
              <p className="mt-3 text-base text-gray-300 sm:mt-5 sm:text-lg md:mt-5 md:text-xl">
                Report urban infrastructure issues instantly with our AI-powered system. 
                We use computer vision to analyze and prioritize repairs, ensuring faster 
                resolution for a safer, more efficient city.
              </p>
              <div className="mt-8 sm:flex sm:gap-4">
                <div className="rounded-md shadow">
                  <Link
                    to="/report"
                    className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 md:py-4 md:text-lg md:px-10"
                  >
                    Report an Issue
                  </Link>
                </div>
                <div className="mt-3 sm:mt-0">
                  <Link
                    to="/track"
                    className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-purple-400 bg-purple-900 bg-opacity-50 hover:bg-purple-800 hover:bg-opacity-60 md:py-4 md:text-lg md:px-10"
                  >
                    Track Complaints
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Right Video */}
          <div className="h-64 sm:h-80 md:h-96 lg:h-full min-h-screen lg:min-h-0 bg-black relative overflow-hidden">
            <video
              className="w-full h-full object-cover"
              src={heroVideo}
              autoPlay
              loop
              muted
              playsInline
              style={{
                filter: 'brightness(1.1) contrast(1.2)',
                mixBlendMode: 'lighten'
              }}
            />
            {/* Black overlay to blend with page background */}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-transparent opacity-60 pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-l from-black via-transparent to-transparent opacity-30 pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-40 pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-transparent opacity-40 pointer-events-none"></div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-12 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-purple-400 font-semibold tracking-wide uppercase">Features</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-white sm:text-4xl">
              AI-Powered Urban Management
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-300 lg:mx-auto">
              Our system uses advanced artificial intelligence to streamline the process of 
              reporting and resolving urban infrastructure issues.
            </p>
          </div>

          <div className="mt-10">
            <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div key={feature.id} className="relative">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-purple-600 text-white">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-6 text-lg font-medium text-white">{feature.title}</h3>
                  <p className="mt-2 text-base text-gray-300">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;