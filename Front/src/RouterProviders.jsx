import { useEffect, useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router';
import App from './App';
import { GamesHome } from './pages/games/GamesHome';
import { Grammar } from './pages/games/grammar/Grammar';
import { Listen } from './pages/games/listen/Listen';
import { Reading } from './pages/games/reading/Reading';
import { Speak } from './pages/games/speak/Speak';
import { Vocabulary } from './pages/games/vocabulary/Vocabulary';
import { Write } from './pages/games/write/Write';
import { HomeUser } from './pages/HomeUser';
import { Profile } from './pages/profile/Profile';
import { UpdateProfile } from './pages/profile/UpdateProfile';
import { Progress } from './pages/Progress';
import { About } from './pages/public/About';
import { Login } from './pages/public/auth/Login';
import { RecoverPassword } from './pages/public/auth/RecoverPassword';
import { Register } from './pages/public/auth/Register';
import { Home } from './pages/public/Home';
import Accessibility from './pages/public/Accesibility';
import AdminDashboard from './pages/admin/AdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';

const RouterProviders = () => {
	const [isAuthenticated, setIsAuthenticated] = useState(false);

	useEffect(() => {
		const token = localStorage.getItem('token');
		if (token) {
			setIsAuthenticated(true);
		} else {
			setIsAuthenticated(false);
		}
	}, []);

	return (
		<HashRouter>
			<Routes>
				<Route element={<App isAuthenticated={isAuthenticated} />}>
					{/* Rutas públicas */}
					<Route index element={<Home />} />
					<Route path='accessibility' element={<Accessibility />} />
					<Route path='about' element={<About />} />
					<Route path='register' element={<Register />} />
					<Route path='login' element={<Login />} />
					<Route path='recover-password' element={<RecoverPassword />} />

					{/* Rutas protegidas (requieren autenticación) */}
					<Route
						path='home'
						element={
							<ProtectedRoute>
								<HomeUser />
							</ProtectedRoute>
						}
					/>
					<Route
						path='progress'
						element={
							<ProtectedRoute>
								<Progress />
							</ProtectedRoute>
						}
					/>
					<Route path='profile'>
						<Route
							index
							element={
								<ProtectedRoute>
									<Profile />
								</ProtectedRoute>
							}
						/>
						<Route
							path='update'
							element={
								<ProtectedRoute>
									<UpdateProfile />
								</ProtectedRoute>
							}
						/>
					</Route>
					<Route path='games'>
						<Route
							index
							element={
								<ProtectedRoute>
									<GamesHome />
								</ProtectedRoute>
							}
						/>
						<Route
							path='grammar'
							element={
								<ProtectedRoute>
									<Grammar />
								</ProtectedRoute>
							}
						/>
						<Route
							path='vocabulary'
							element={
								<ProtectedRoute>
									<Vocabulary />
								</ProtectedRoute>
							}
						/>
						<Route
							path='write'
							element={
								<ProtectedRoute>
									<Write />
								</ProtectedRoute>
							}
						/>
						<Route
							path='read'
							element={
								<ProtectedRoute>
									<Reading />
								</ProtectedRoute>
							}
						/>
						<Route
							path='speak'
							element={
								<ProtectedRoute>
									<Speak />
								</ProtectedRoute>
							}
						/>
						<Route
							path='listen'
							element={
								<ProtectedRoute>
									<Listen />
								</ProtectedRoute>
							}
						/>
					</Route>

					{/* Rutas de administración (solo ADMIN y TUTOR) */}
					<Route
						path='admin/dashboard'
						element={
							<ProtectedRoute allowedRoles={['ADMIN', 'TUTOR']}>
								<AdminDashboard />
							</ProtectedRoute>
						}
					/>
				</Route>
			</Routes>
		</HashRouter>
	);
};

export default RouterProviders;
