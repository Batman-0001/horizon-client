import './assets/css/App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import {} from 'react-router-dom';
import AuthLayout from './layouts/auth';
import AdminLayout from './layouts/admin';
import { hasAuthToken } from './api/authApi';
import {
  ChakraProvider,
  // extendTheme
} from '@chakra-ui/react';
import initialTheme from './theme/theme'; //  { themeGreen }
import { useState } from 'react';
// Chakra imports

function RequireAuth({ children }) {
  if (!hasAuthToken()) {
    return <Navigate to="/auth/sign-in" replace />;
  }
  return children;
}

export default function Main() {
  // eslint-disable-next-line
  const [currentTheme, setCurrentTheme] = useState(initialTheme);
  const isAuthenticated = hasAuthToken();

  return (
    <ChakraProvider theme={currentTheme}>
      <Routes>
        <Route path="auth/*" element={<AuthLayout />} />
        <Route
          path="admin/*"
          element={
            <RequireAuth>
              <AdminLayout theme={currentTheme} setTheme={setCurrentTheme} />
            </RequireAuth>
          }
        />
        <Route
          path="/"
          element={
            <Navigate
              to={isAuthenticated ? '/admin/default' : '/auth/sign-in'}
              replace
            />
          }
        />
      </Routes>
    </ChakraProvider>
  );
}
