import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../API';
import { ConfirmationModal } from '../../components/ConfirmationModal';

export const UpdateProfile = () => {
	const navigate = useNavigate();
	// eslint-disable-next-line no-unused-vars
	const { logout, updateUser } = useAuth();

	// Asegura que user nunca sea null
	const user = JSON.parse(localStorage.getItem('user') || '{}');
	const [form, setForm] = useState({
		email: user.email || '',
		username: user.username || '',
		newPassword: '',
		confirmNewPassword: '',
	});

	const [profilePicture, setProfilePicture] = useState(user.profilePicture || '');
	const [selectedFile, setSelectedFile] = useState(null);
	const [previewUrl, setPreviewUrl] = useState(() => {
		if (user.profilePicture && user.profilePicture.startsWith('profile-pictures/')) {
			return `${API_URL}/${user.profilePicture}`;
		}
		return '/default-profile-picture.jpg';
	});
	const [error, setError] = useState('');
	// eslint-disable-next-line no-unused-vars
	const [success, setSuccess] = useState('');
	const [showConfirmModal, setShowConfirmModal] = useState(false);

	const [showNewPassword, setShowNewPassword] = useState(false);
	const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

	// Previsualización de la imagen seleccionada
	useEffect(() => {
		if (selectedFile) {
			const objectUrl = URL.createObjectURL(selectedFile);
			setPreviewUrl(objectUrl);
			return () => URL.revokeObjectURL(objectUrl);
		} else if (profilePicture && profilePicture.startsWith('profile-pictures/')) {
			setPreviewUrl(`${API_URL}/${profilePicture}`);
		} else {
			setPreviewUrl('/default-profile-picture.jpg');
		}
	}, [selectedFile, profilePicture]);

	// Sanitizar URL para prevenir XSS
	const getSafeImageUrl = (url) => {
		if (!url) return '/default-profile-picture.jpg';
		// Solo permitir URLs del servidor o rutas locales válidas
		if (url.startsWith(API_URL) || url.startsWith('/')) {
			return url;
		}
		return '/default-profile-picture.jpg';
	};

	const handleChange = (e) => {
		if (e.target.name === 'email') {
			setForm({ ...form, [e.target.name]: e.target.value.toLowerCase() });
		} else {
			setForm({ ...form, [e.target.name]: e.target.value });
		}
	};

	const handleFileChange = (e) => {
		if (e.target.files && e.target.files[0]) {
			setSelectedFile(e.target.files[0]);
		}
	};

	const [fieldErrors, setFieldErrors] = useState({});

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');
		setSuccess('');
		setFieldErrors({});

		const newFieldErrors = {};

		if (form.newPassword || form.confirmNewPassword) {
			if (form.newPassword !== form.confirmNewPassword) {
				newFieldErrors.confirmNewPassword = 'Passwords do not match';
			}
			if (
				form.newPassword &&
				(form.newPassword.length < 8 || form.newPassword.length > 15)
			) {
				newFieldErrors.newPassword = 'Password must be between 8 and 15 characters';
			}
		}

		if (Object.keys(newFieldErrors).length > 0) {
			setFieldErrors(newFieldErrors);
			setError('Please fix the errors before submitting.');
			return;
		}

		setShowConfirmModal(true);
	};

	const confirmSubmit = async () => {
		setShowConfirmModal(false);

		try {
			let updatedProfilePicture = profilePicture;

			if (selectedFile) {
				const formData = new FormData();
				formData.append('profilePicture', selectedFile);

				// Obtener token del localStorage para autenticación
				const token = localStorage.getItem('token');

				const uploadRes = await fetch(`${API_URL}/user/upload-profile-picture`, {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${token}`,
					},
					body: formData,
				});
				const uploadData = await uploadRes.json();
				if (uploadRes.ok) {
					updatedProfilePicture = uploadData.filename;
					setProfilePicture(updatedProfilePicture); // Actualiza el estado para futuras previsualizaciones
				} else {
					setError(uploadData.error || 'Error uploading profile picture');
					return;
				}
			}

			// Obtener token del localStorage para autenticación
			const token = localStorage.getItem('token');

			const res = await fetch(`${API_URL}/user/update-profile`, {
				method: 'PUT',
				headers: { 
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`,
				},
				body: JSON.stringify({
					email: form.email,
					username: form.username,
					newPassword: form.newPassword,
					profilePicture: updatedProfilePicture,
				}),
			});
			const data = await res.json();
			if (res.ok) {
				localStorage.setItem('profileUpdateSuccess', 'Profile updated successfully!');
				localStorage.setItem('user', JSON.stringify(data.user));
				updateUser(data.user);
				setTimeout(() => navigate('/profile'), 1200);
			} else {
				setError(data.error || 'Error updating profile');
			}
			// eslint-disable-next-line no-unused-vars
		} catch (err) {
			setError('Server error');
		}
	};

	return (
		<main className='w-full relative bg-[#fff] flex flex-col items-start justify-start text-left text-sm text-[#000] font-lexend'>
			<section className='self-stretch bg-[#f7fafc] min-h-[800px] overflow-hidden flex flex-col items-start justify-start'>
				<section className='self-stretch flex flex-col items-start justify-start'>
					<header className='self-stretch flex flex-row items-start justify-center py-5 px-4 md:px-16 lg:px-40 box-border text-base text-[#0d171c]'>
						<div className='flex-1 overflow-hidden flex flex-col items-start justify-start max-w-[960px]'>
							<div className='self-stretch flex flex-row items-start justify-between flex-wrap content-start p-4 text-[32px]'>
								<div className='flex flex-col items-start justify-start gap-3 min-w-[220px]'>
									<h1
										className='leading-10 font-bold text-2xl md:text-3xl lg:text-4xl'
										tabIndex={0}
									>
										Edit Profile
									</h1>
									<p className='text-sm text-[#4C7490]' tabIndex={0}>
										Update your account information.
									</p>
								</div>
							</div>
							<section className='self-stretch flex flex-col items-center justify-start'>
								<div className='flex flex-col items-center justify-start gap-4'>
									<img
										className='w-24 h-24 md:w-32 md:h-32 rounded-full object-cover min-h-[96px] md:min-h-[128px] border border-[#d4dee3]'
										alt='Profile picture'
										src={getSafeImageUrl(previewUrl)}
                                        tabIndex={0}
									/>
									<label
										className='rounded-[20px] bg-[#e8edf2] h-10 flex items-center justify-center px-4 min-w-[84px] max-w-[240px] font-medium mt-4 focus:outline-2 focus:outline-blue-400 hover:bg-[#d1dee8] transition-colors duration-150 cursor-pointer'
										tabIndex={0}
										aria-label='Change profile picture'
									>
										<input
											type='file'
											accept='image/*'
											className='hidden'
											onChange={handleFileChange}
										/>
										Change Profile Picture
									</label>
								</div>
							</section>
							<form
								className='w-full max-w-[480px] mx-auto flex flex-col gap-4 mt-6'
								aria-label='Update profile form'
								onSubmit={handleSubmit}
							>
								<div className='flex flex-col items-start'>
									<label htmlFor='email' className='leading-6 font-medium' tabIndex={0}>
										Email
									</label>
									<input
										id='email'
										name='email'
										type='email'
										autoComplete='email'
										placeholder='student@example.com'
										className='self-stretch rounded-xl bg-[#e8edf2] h-10 p-2 focus:outline-2 focus:outline-blue-400'
										aria-required='true'
										value={form.email}
										onChange={handleChange}
									/>
								</div>
								<div className='flex flex-col items-start'>
									<label
										htmlFor='username'
										className='leading-6 font-medium'
										tabIndex={0}
									>
										Username
									</label>
									<input
										id='username'
										name='username'
										type='text'
										autoComplete='username'
										placeholder='john_student'
										className='self-stretch rounded-xl bg-[#e8edf2] h-10 p-2 focus:outline-2 focus:outline-blue-400'
										aria-required='true'
										value={form.username}
										onChange={handleChange}
									/>
								</div>
								<div className='flex flex-col items-start relative'>
									<label
										htmlFor='newPassword'
										className='leading-6 font-medium'
										tabIndex={0}
									>
										New Password
									</label>
									<input
										id='newPassword'
										name='newPassword'
										type={showNewPassword ? 'text' : 'password'}
										autoComplete='new-password'
										placeholder='123Password'
										className={`self-stretch rounded-xl bg-[#e8edf2] h-10 p-2 pr-10 focus:outline-2 focus:outline-blue-400 ${
											fieldErrors.newPassword ? 'border border-red-500' : ''
										}`}
										value={form.newPassword}
										onChange={handleChange}
										aria-invalid={!!fieldErrors.newPassword}
									/>
									<button
										type='button'
										onClick={() => setShowNewPassword((v) => !v)}
										className='absolute right-3 top-[32px] md:top-[28px] p-1 bg-transparent border-none outline-none focus:outline-2 focus:outline-blue-500 focus:ring-2 focus:ring-blue-300 rounded hover:bg-gray-100 transition-all duration-150'
										aria-label={showNewPassword ? 'Hide password' : 'Show password'}
										title={showNewPassword ? 'Hide password' : 'Show password'}
									>
										<img
											src={showNewPassword ? '/eye-slash.png' : '/eye.png'}
											alt={showNewPassword ? 'Hide password' : 'Show password'}
											className='w-6 h-6'
										/>
									</button>
									{fieldErrors.newPassword && (
										<span className='text-red-600 text-xs mt-1' tabIndex={0}>
											{fieldErrors.newPassword}
										</span>
									)}
								</div>
								<div className='flex flex-col items-start relative'>
									<label
										htmlFor='confirmNewPassword'
										className='leading-6 font-medium'
										tabIndex={0}
									>
										Confirm New Password
									</label>
									<input
										id='confirmNewPassword'
										name='confirmNewPassword'
										type={showConfirmNewPassword ? 'text' : 'password'}
										autoComplete='new-password'
										placeholder='123Password'
										className={`self-stretch rounded-xl bg-[#e8edf2] h-10 p-2 pr-10 focus:outline-2 focus:outline-blue-400 ${
											fieldErrors.confirmNewPassword ? 'border border-red-500' : ''
										}`}
										value={form.confirmNewPassword}
										onChange={handleChange}
										aria-invalid={!!fieldErrors.confirmNewPassword}
									/>
									<button
										type='button'
										onClick={() => setShowConfirmNewPassword((v) => !v)}
										className='absolute right-3 top-[32px] md:top-[28px] p-1 bg-transparent border-none outline-none focus:outline-2 focus:outline-blue-500 focus:ring-2 focus:ring-blue-300 rounded hover:bg-gray-100 transition-all duration-150'
										aria-label={
											showConfirmNewPassword ? 'Hide password' : 'Show password'
										}
										title={
											showConfirmNewPassword ? 'Hide password' : 'Show password'
										}
									>
										<img
											src={showConfirmNewPassword ? '/eye-slash.png' : '/eye.png'}
											alt={showConfirmNewPassword ? 'Hide password' : 'Show password'}
											className='w-6 h-6'
										/>
									</button>
									{fieldErrors.confirmNewPassword && (
										<span className='text-red-600 text-xs mt-1' tabIndex={0}>
											{fieldErrors.confirmNewPassword}
										</span>
									)}
								</div>
								{error && (
									<div
										className='flex items-center gap-3 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-2'
										tabIndex={0}
										role='alert'
									>
										<img src='/x-circle.png' alt='Error' className='w-6 h-6' />
										<span>{error}</span>
									</div>
								)}
								<button
									type='submit'
									className='rounded-3xl bg-[#1377B9] h-12 flex items-center justify-center px-5 min-w-[84px] max-w-[480px] font-bold text-white mt-4 focus:outline-2 focus:outline-blue-400 hover:bg-[#1d7fc2] transition-colors duration-150'
									aria-label='Save changes to your profile'
								>
									Save Changes
								</button>
							</form>
						</div>
					</header>
				</section>
			</section>
			
			<ConfirmationModal
				isOpen={showConfirmModal}
				title="Update Profile"
				message="Are you sure you want to save these changes to your profile?"
				onConfirm={confirmSubmit}
				onCancel={() => setShowConfirmModal(false)}
				confirmText="Save Changes"
				cancelText="Cancel"
			/>
		</main>
	);
};
