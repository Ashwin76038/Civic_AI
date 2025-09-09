import React from "react";
import { Navigate } from "react-router-dom";

const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  // Check if the user is an admin
  const isAdmin = localStorage.getItem("role") === "admin";

  return isAdmin ? children : <Navigate to="/login" replace />;
};

export default AdminRoute;
