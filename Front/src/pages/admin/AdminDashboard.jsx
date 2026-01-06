import { useState, useEffect } from 'react';
import api from '../../API';
import RoleBadge from '../../components/RoleBadge';
import { useAuth } from '../../context/AuthContext';

const AdminDashboard = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [newRole, setNewRole] = useState('');

    // Función para formatear nombres de roles
    const formatRoleName = (role) => {
        const roleNames = {
            ADMIN: 'Administrador',
            TUTOR: 'Tutor',
            STUDENT_PRO: 'Estudiante Pro',
            STUDENT_FREE: 'Estudiante',
        };
        return roleNames[role] || role;
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [usersRes, statsRes] = await Promise.all([
                api.get('/user/admin/users'),
                api.get('/user/admin/stats'),
            ]);

            setUsers(usersRes.data.users);
            setStats(statsRes.data);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || 'Error loading data');
        } finally {
            setLoading(false);
        }
    };

    const handleChangeRole = async (userId, role) => {
        try {
            await api.put(`/user/admin/users/${userId}/role`, { role });
            alert('Role updated successfully');
            loadData(); // Reload data
            setSelectedUser(null);
        } catch (err) {
            alert(err.response?.data?.error || 'Error changing role');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <p className="text-xl">Loading...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <p className="text-xl text-red-600">{error}</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold mb-8">Administration Panel</h1>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-blue-100 p-6 rounded-lg">
                    <h3 className="text-xl font-bold mb-3">Total Users</h3>
                    <p className="text-4xl font-bold">{stats?.totalUsers || 0}</p>
                </div>
                <div className="bg-green-100 p-6 rounded-lg">
                    <h3 className="text-xl font-bold mb-3">Total Games</h3>
                    <p className="text-4xl font-bold">{stats?.totalGames || 0}</p>
                </div>
                <div className="bg-purple-100 p-6 rounded-lg">
                    <h3 className="text-xl font-bold mb-3">Users by Role</h3>
                    <div className="text-base space-y-1">
                        {stats?.usersByRole?.map((r) => (
                            <div key={r.role} className="flex justify-between">
                                <span>{formatRoleName(r.role)}:</span>
                                <span className="font-bold">{r._count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* User List */}
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <table className="min-w-full">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                User
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                Email
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                Role
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                Games
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                Registration Date
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((u) => (
                            <tr key={u.id}>
                                <td className="px-6 py-4 whitespace-nowrap">{u.username}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{u.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <RoleBadge role={u.role} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {u._count.gameHistory}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {new Date(u.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {u.id !== user.id && (
                                        <button
                                            onClick={() => {
                                                setSelectedUser(u);
                                                setNewRole(u.role);
                                            }}
                                            className="text-blue-600 hover:text-blue-900"
                                        >
                                            Change Role
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal to change role */}
            {selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedUser(null)}>
                    <div className="bg-white p-8 rounded-lg max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4">
                            Change Role for {selectedUser.username}
                        </h3>
                        <div className="mb-4">
                            <label className="block mb-2 font-semibold">New Role:</label>
                            <select
                                value={newRole}
                                onChange={(e) => setNewRole(e.target.value)}
                                className="w-full border border-gray-300 rounded px-3 py-2"
                            >
                                <option value="ADMIN">Administrator</option>
                                <option value="TUTOR">Tutor</option>
                                <option value="STUDENT_PRO">Pro Student</option>
                                <option value="STUDENT_FREE">Student</option>
                            </select>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() =>
                                    handleChangeRole(selectedUser.id, newRole)
                                }
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                            >
                                Confirm
                            </button>
                            <button
                                onClick={() => setSelectedUser(null)}
                                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
