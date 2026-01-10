import { Link } from 'react-router';
import StarIcon from '../components/icons/StarIcon';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import hero from '../../public/hero.jpg';

export const HomeUser = () => {
	const [loginMessage, setLoginMessage] = useState('');
	const { user } = useAuth();

	useEffect(() => {
		const msg = localStorage.getItem('loginSuccess');
		if (msg) {
			setLoginMessage(msg);
			localStorage.removeItem('loginSuccess');
		}
	}, []);

	const showUpgradeBanner = user?.role === 'STUDENT_FREE';

	return (
		<main className='w-full relative bg-[#fff] min-h-screen flex flex-col items-center justify-between text-center text-sm text-[#0f141a] font-lexend'>
			{loginMessage && (
				<div className='flex items-center gap-3 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6 mt-8 max-w-xl mx-auto z-20'>
					<img src='/check-circle.png' alt='Success' className='w-6 h-6' />
					<span>{loginMessage}</span>
				</div>
			)}

			{/* Banner promocional para usuarios FREE */}
			{showUpgradeBanner && (
				<div className='w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 px-4 shadow-lg z-20'>
					<div className='max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4'>
						<div className='flex items-center gap-3'>
							<div className='bg-white/20 rounded-full p-2'>
								<StarIcon className='w-5 h-5' />
							</div>
							<div className='text-left'>
								<p className='font-semibold text-sm sm:text-base'>Unlock Premium Features</p>
								<p className='text-xs sm:text-sm opacity-90'>Unlimited access to lessons, exams and priority support</p>
							</div>
						</div>
						<Link
							to='/billing/pricing'
							className='bg-white text-purple-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-50 transition-colors duration-150 text-sm whitespace-nowrap'
						>
							Upgrade to Pro
						</Link>
					</div>
				</div>
			)}
			<section className='w-full max-w-[1280px] flex-1 flex flex-col items-center justify-center min-h-[400px] md:min-h-[500px] lg:min-h-[600px]'>
				<section className='w-full flex flex-row items-center justify-center py-5 px-4 md:px-16 lg:px-40 box-border text-2xl md:text-4xl lg:text-5xl text-[#fff]'>
					<div className='w-full max-w-[960px] relative flex flex-col justify-center'>
						<div className='relative w-full flex flex-col items-center justify-center'>
							<div className='w-full md:w-[1000px] flex flex-col items-center justify-center p-2 md:p-4 box-border'>
								<div
									className='w-full relative rounded-xl bg-cover bg-no-repeat bg-center min-h-[220px] sm:min-h-[320px] md:min-h-[480px] flex flex-col items-center justify-center shadow-lg'
									style={{ backgroundImage: `url(${hero})` }}
									alt="Image represent a group of friend talking and rest on a sofa" tabIndex={0}
								>
									<div
										className='absolute inset-0 bg-black/40 rounded-xl pointer-events-none'
										aria-hidden='true'
									></div>
									<div className='w-full flex flex-col items-center justify-center gap-2 px-2 sm:px-4 mt-8 sm:mt-16 relative z-10'>
										<h1
											className='w-full max-w-xl tracking-tight text-white leading-9 sm:leading-[48px] font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl'
											aria-label='Main headline'
											tabIndex={0}
										>
											Learn English by playing!
										</h1>
										<p className='w-full max-w-2xl leading-6 text-base sm:text-lg mt-2 text-[#e6e8eb]'
											tabIndex={0}>
											Learn English in a fun and effective way. At EduSoft, we transform
											language learning into an entertaining experience through
											interactive games that will help you improve your comprehension,
											vocabulary, and conversation skills.
										</p>
									</div>
									<div className='flex justify-center w-full mt-6 sm:mt-10 relative z-10'>
										<Link
											to='/games'
											className='rounded-xl text-white bg-[#1579C1] hover:bg-[#1d7fc1] h-12 flex items-center justify-center px-6 min-w-[120px] max-w-xs text-base sm:text-lg leading-6 whitespace-nowrap focus:outline-2 focus:outline-[#0d171c] transition-colors duration-150 shadow-md'
											aria-label='Start games'
											tabIndex={0}
											title='Start playing now'
										>
											Start Now
										</Link>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>
			</section>
		</main>
	);
};
