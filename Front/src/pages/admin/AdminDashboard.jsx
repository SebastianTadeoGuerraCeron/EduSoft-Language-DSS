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
            setError(err.response?.data?.error || 'Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const handleChangeRole = async (userId, role) => {
        try {
            await api.put(`/user/admin/users/${userId}/role`, { role });
            alert('Rol actualizado exitosamente');
            loadData(); // Recargar datos
            setSelectedUser(null);
        } catch (err) {
            alert(err.response?.data?.error || 'Error al cambiar el rol');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <p className="text-xl">Cargando...</p>
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
            <h1 className="text-4xl font-bold mb-8">Panel de Administración</h1>

            {/* Estadísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-blue-100 p-6 rounded-lg">
                    <h3 className="text-xl font-bold mb-3">Total Usuarios</h3>
                    <p className="text-4xl font-bold">{stats?.totalUsers || 0}</p>
                </div>
                <div className="bg-green-100 p-6 rounded-lg">
                    <h3 className="text-xl font-bold mb-3">Total Juegos</h3>
                    <p className="text-4xl font-bold">{stats?.totalGames || 0}</p>
                </div>
                <div className="bg-purple-100 p-6 rounded-lg">
                    <h3 className="text-xl font-bold mb-3">Usuarios por Rol</h3>
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

            {/* Lista de usuarios */}
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <table className="min-w-full">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                Usuario
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                Email
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                Rol
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                Juegos
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                Fecha Registro
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                Acciones
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
                                            Cambiar Rol
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal para cambiar rol */}
            {selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedUser(null)}>
                    <div className="bg-white p-8 rounded-lg max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4">
                            Cambiar Rol de {selectedUser.username}
                        </h3>
                        <div className="mb-4">
                            <label className="block mb-2 font-semibold">Nuevo Rol:</label>
                            <select
                                value={newRole}
                                onChange={(e) => setNewRole(e.target.value)}
                                className="w-full border border-gray-300 rounded px-3 py-2"
                            >
                                <option value="ADMIN">Administrador</option>
                                <option value="TUTOR">Tutor</option>
                                <option value="STUDENT_PRO">Estudiante Pro</option>
                                <option value="STUDENT_FREE">Estudiante</option>
                            </select>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() =>
                                    handleChangeRole(selectedUser.id, newRole)
                                }
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                            >
                                Confirmar
                            </button>
                            <button
                                onClick={() => setSelectedUser(null)}
                                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
