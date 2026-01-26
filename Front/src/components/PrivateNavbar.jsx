import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import logoApp from "../../public/logo.png";
import { API_URL } from "../API";
import burgerIcon from "../assets/burger-icon.svg";
import { useAuth } from "../context/AuthContext";
import { ConfirmationModal } from "./ConfirmationModal";
import RoleBadge from "./RoleBadge";

const PrivateNavbar = () => {
  const { user, hasRole, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const profilePicture = user?.profilePicture || "default-profile-picture.jpg";

  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [createContentDropdownOpen, setCreateContentDropdownOpen] =
    useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Función para verificar si el link está activo
  const isActiveLink = (path) => {
    if (path === "/home") {
      return location.pathname === "/home" || location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // Build navigation links based on user role
  let navLinks = [];

  if (hasRole(["TUTOR"])) {
    // Tutor: Home, My Lessons, My Exams, My Content (dropdown)
    navLinks = [
      { to: "/home", label: "Home" },
      { to: "/tutor/lessons", label: "My Lessons" },
      { to: "/exams", label: "My Exams" },
      {
        label: "Create Content",
        dropdown: true,
        items: [
          { to: "/tutor/create-lesson", label: "Create Lesson" },
          { to: "/tutor/exams/create", label: "Create Exam" },
        ],
      },
    ];
  } else if (hasRole(["ADMIN"])) {
    // Admin: Home, Admin
    navLinks = [
      { to: "/home", label: "Home" },
      { to: "/admin/dashboard", label: "Admin" },
    ];
  } else if (hasRole(["STUDENT_PRO", "STUDENT_FREE"])) {
    // Student: Home, My Learning, Exams, Games
    navLinks = [
      { to: "/home", label: "Home" },
      { to: "/student/lessons", label: "My Learning" },
      { to: "/exams", label: "Exams" },
      { to: "/games", label: "Games" },
    ];
  }

  // User dropdown items
  const userDropdownItems = [
    { to: "/profile", label: "Profile" },
    ...(!hasRole(["ADMIN"]) ? [{ to: "/progress", label: "Progress" }] : []),
    { to: "/about", label: "About us/Help" },
    { action: () => setShowLogoutModal(true), label: "Log out" },
  ];

  return (
    <nav className="w-full border-b border-[#e6e8eb] bg-white relative">
      <div className="flex items-center justify-between px-4 py-2 md:px-10 md:py-3 max-w-7xl mx-auto">
        <a href="/" className="flex items-center gap-3 min-w-[100px] h-10">
          <img
            className="w-[90px] md:w-[104px] h-[40px] md:h-[49.1px] object-cover"
            alt="Logo"
            src={logoApp}
          />
          <span className="w-px h-[23px]" aria-hidden="true" />
        </a>

        {/* Hamburger for mobile */}
        <button
          className="md:hidden flex items-center justify-center p-2 rounded focus:outline-2 focus:outline-blue-400"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <img src={burgerIcon} alt="Menu" className="w-6 h-6" />
        </button>

        {/* Desktop nav */}
        <ul className="hidden md:flex flex-row items-center gap-4 lg:gap-8 list-none m-0 p-0">
          {navLinks.map((link, index) => (
            <li
              key={link.to || index}
              className="h-10 flex items-center relative"
            >
              {link.dropdown ? (
                // Dropdown for Create Content
                <div className="relative">
                  <button 
                    className="relative leading-[21px] font-medium px-3 py-2 rounded-lg transition-colors duration-150 flex items-center gap-2 text-[#397DA7] hover:text-[#1d7fc1] hover:bg-[#f7fafc]"
                    onClick={() => setCreateContentDropdownOpen(!createContentDropdownOpen)}
                    onBlur={() => setTimeout(() => setCreateContentDropdownOpen(false), 200)}
                  >
                    {link.label}
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${createContentDropdownOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  {createContentDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-[#e6e8eb] py-2 z-50">
                      {link.items.map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          className="block px-4 py-2 text-[#397DA7] hover:bg-[#f7fafc] hover:text-[#1d7fc1] transition-colors"
                          onClick={() => setCreateContentDropdownOpen(false)}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to={link.to}
                  className={`relative leading-[21px] font-medium px-3 py-2 rounded-lg transition-colors duration-150 flex items-center gap-2 ${
                    isActiveLink(link.to)
                      ? "bg-[#e8edf2] text-[#1d7fc1] hover:bg-[#d1dee8]"
                      : "text-[#397DA7] hover:text-[#1d7fc1] hover:bg-[#f7fafc]"
                  }`}
                >
                  {link.label}
                </Link>
              )}
            </li>
          ))}

          {/* User dropdown */}
          <li className="h-10 flex items-center gap-2 relative">
            {user?.role && <RoleBadge role={user.role} />}
            <button
              className="flex items-center gap-2 focus:outline-none"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              onBlur={() => setTimeout(() => setUserDropdownOpen(false), 200)}
            >
              <img
                className="w-10 rounded-full h-10 object-cover border-2 border-[#e6e8eb] hover:border-[#1d7fc1] transition-colors cursor-pointer"
                alt="Avatar profile"
                src={
                  profilePicture.startsWith("profile-pictures/")
                    ? `${API_URL}/${profilePicture}`
                    : "/default-profile-picture.jpg"
                }
              />
            </button>
            {userDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-[#e6e8eb] py-2 z-50">
                {userDropdownItems.map((item, idx) =>
                  item.action ? (
                    <button
                      key={idx}
                      onClick={item.action}
                      className="w-full text-left block px-4 py-2 text-[#397DA7] hover:bg-[#f7fafc] hover:text-[#1d7fc1] transition-colors"
                    >
                      {item.label}
                    </button>
                  ) : (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="block px-4 py-2 text-[#397DA7] hover:bg-[#f7fafc] hover:text-[#1d7fc1] transition-colors"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      {item.label}
                    </Link>
                  )
                )}
              </div>
            )}
          </li>
        </ul>
      </div>

      {/* Mobile nav */}
      <ul
        className={`md:hidden flex flex-col items-center gap-2 bg-white border-t border-[#e6e8eb] px-4 py-2 transition-all duration-200 ${
          menuOpen
            ? "max-h-[600px] opacity-100"
            : "max-h-0 opacity-0 overflow-hidden"
        }`}
        aria-label="Navigation menu"
      >
        {navLinks.map((link, index) => (
          <li key={link.to || index} className="w-full">
            {link.dropdown ? (
              <div className="w-full">
                <button
                  className="w-full px-3 py-3 text-base font-medium rounded-lg transition-colors duration-150 text-center flex items-center justify-center gap-2 text-[#397DA7] hover:text-[#1d7fc1] hover:bg-[#f7fafc]"
                  onClick={() =>
                    setCreateContentDropdownOpen(!createContentDropdownOpen)
                  }
                >
                  ➕ {link.label}
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {createContentDropdownOpen && (
                  <div className="pl-4 mt-1">
                    {link.items.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        className="block w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-150 text-center text-[#397DA7] hover:text-[#1d7fc1] hover:bg-[#f7fafc]"
                        onClick={() => {
                          setMenuOpen(false);
                          setCreateContentDropdownOpen(false);
                        }}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                to={link.to}
                className={`w-full px-3 py-3 text-base font-medium rounded-lg transition-colors duration-150 text-center flex items-center justify-center gap-2 ${
                  isActiveLink(link.to)
                    ? "bg-[#e8edf2] text-[#1d7fc1] hover:bg-[#d1dee8]"
                    : "text-[#397DA7] hover:text-[#1d7fc1] hover:bg-[#f7fafc]"
                }`}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}

        {/* User dropdown items for mobile navigation */}
        <li className="w-full border-t border-[#e6e8eb] pt-2">
          {userDropdownItems.map((item, idx) => (
            <React.Fragment key={item.to || idx}>
              {item.action ? (
                <button
                  onClick={() => {
                    item.action();
                    setMenuOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-base font-medium rounded-lg transition-colors duration-150 text-center text-[#397DA7] hover:text-[#1d7fc1] hover:bg-[#f7fafc]"
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  to={item.to}
                  className="block w-full px-3 py-2 text-base font-medium rounded-lg transition-colors duration-150 text-center text-[#397DA7] hover:text-[#1d7fc1] hover:bg-[#f7fafc]"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </li>

        <li className="flex flex-col items-center gap-2 py-2">
          {user?.role && <RoleBadge role={user.role} />}
          <img
            className="w-10 rounded-full h-10 object-cover border border-[#e6e8eb]"
            alt="Profile profile"
            src={
              profilePicture.startsWith("profile-pictures/")
                ? `${API_URL}/${profilePicture}`
                : "/default-profile-picture.jpg"
            }
            tabIndex={0}
          />
        </li>
      </ul>

      {/* Logout Confirmation Modal */}
      <ConfirmationModal
        isOpen={showLogoutModal}
        title="Log out"
        message="Are you sure you want to log out?"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutModal(false)}
        confirmText="Log out"
        cancelText="Cancel"
      />
    </nav>
  );
};

export default PrivateNavbar;
