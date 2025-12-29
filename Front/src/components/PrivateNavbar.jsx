import { useState } from 'react';
import { Link, useLocation } from 'react-router';

import logoApp from '../../public/logo.png';
import burgerIcon from '../assets/burger-icon.svg';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../API';
import RoleBadge from './RoleBadge';

const PrivateNavbar = () => {
	const { user, hasRole } = useAuth();
	const location = useLocation();
	const profilePicture = user?.profilePicture || 'default-profile-picture.jpg';

	const [menuOpen, setMenuOpen] = useState(false);

	// Links base para todos los usuarios
	const baseLinks = [
		{ to: '/home', label: 'Home' },
		{ to: '/games', label: 'Games' },
		{ to: '/progress', label: 'Progress' },
		{ to: '/profile', label: 'Profile' },
		{ to: '/about', label: 'About us/Help' },
	];

	// Agregar link de administración para ADMIN y TUTOR
	const navLinks = hasRole(['ADMIN', 'TUTOR'])
		? [...baseLinks, { to: '/admin/dashboard', label: '🔐 Admin' }]
		: baseLinks;

	// Función para verificar si el link está activo
	const isActiveLink = (path) => {
		if (path === '/home') {
			return location.pathname === '/home' || location.pathname === '/';
		}
		return location.pathname.startsWith(path);
	};

	return (
		<nav className='w-full border-b border-[#e6e8eb] bg-white'>
			<div className='flex items-center justify-between px-4 py-2 md:px-10 md:py-3 max-w-7xl mx-auto'>
				<a href='/' className='flex items-center gap-3 min-w-[100px] h-10'>
					<img
						className='w-[90px] md:w-[104px] h-[40px] md:h-[49.1px] object-cover'
						alt='Logo'
						src={logoApp}
					/>
					<span className='w-px h-[23px]' aria-hidden='true' />
				</a>

				{/* Hamburger for mobile */}
				<button
					className='md:hidden flex items-center justify-center p-2 rounded focus:outline-2 focus:outline-blue-400'
					aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
					onClick={() => setMenuOpen((v) => !v)}
				>
					<img src={burgerIcon} alt='Menu' className='w-6 h-6' />
				</button>

				{/* Desktop nav */}
				<ul className='hidden md:flex flex-row items-center gap-4 lg:gap-8 list-none m-0 p-0'>
					{navLinks.map((link) => (
						<li key={link.to} className='h-10 flex items-center'>
							<Link
								to={link.to}
								className={`relative leading-[21px] font-medium px-3 py-2 rounded-lg transition-colors duration-150 ${isActiveLink(link.to)
										? 'bg-[#e8edf2] text-[#1d7fc1] hover:bg-[#d1dee8]'
										: 'text-[#397DA7] hover:text-[#1d7fc1] hover:bg-[#f7fafc]'
									}`}
							>
								{link.label}
							</Link>
						</li>
					))}
					<li className='h-10 flex items-center gap-2'>
						{user?.role && <RoleBadge role={user.role} />}
						<img
							className='w-10 rounded-full h-10 object-cover border border-[#e6e8eb]'
							alt='Avatar profile'
							src={
								profilePicture.startsWith('profile-pictures/')
									? `${API_URL}/${profilePicture}`
									: '/default-profile-picture.jpg'
							}
						/>
					</li>
				</ul>
			</div>

			{/* Mobile nav */}
			<ul
				className={`md:hidden flex flex-col items-center gap-2 bg-white border-t border-[#e6e8eb] px-4 py-2 transition-all duration-200 ${menuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
					}`}
				aria-label='Menú de navegación'
			>
				{navLinks.map((link) => (
					<li key={link.to} className='w-full'>
						<Link
							to={link.to}
							className={`block w-full px-3 py-3 text-base font-medium rounded-lg transition-colors duration-150 text-center ${isActiveLink(link.to)
									? 'bg-[#e8edf2] text-[#1d7fc1] hover:bg-[#d1dee8]'
									: 'text-[#397DA7] hover:text-[#1d7fc1] hover:bg-[#f7fafc]'
								}`}
							onClick={() => setMenuOpen(false)}
						>
							{link.label}
						</Link>
					</li>
				))}
				<li className='flex flex-col items-center gap-2 py-2'>
					{user?.role && <RoleBadge role={user.role} />}
					<img
						className='w-10 rounded-full h-10 object-cover border border-[#e6e8eb]'
						alt='Profile profile'
						src={
							profilePicture.startsWith('profile-pictures/')
								? `${API_URL}/${profilePicture}`
								: '/default-profile-picture.jpg'
						}
						tabIndex={0}
					/>
				</li>
			</ul>
		</nav>
	);
};

export default PrivateNavbar;
