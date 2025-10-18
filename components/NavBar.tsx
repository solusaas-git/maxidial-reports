'use client';

import { useAuth } from '@/lib/auth-context';
import { usePathname, useRouter } from 'next/navigation';

export default function NavBar() {
  const { isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Don't show navbar on login page
  if (pathname === '/login') {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center">
                <img 
                  src="/logos/logo_maxidial.png" 
                  alt="Maxi Dial Logo" 
                  className="w-16 h-16 rounded-lg"
                />
                <div className="ml-3">
                  <h1 className="text-xl font-bold text-gray-900">Maxi Dial Reports</h1>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden sm:block">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>API Connected</span>
              </div>
            </div>
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <svg className="h-4 w-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

