/**
 * Componente para mostrar el badge del rol del usuario
 */
const RoleBadge = ({ role }) => {
    const roleConfig = {
        ADMIN: {
            label: 'Administrador',
            bgColor: 'bg-red-600',
            textColor: 'text-white',
            icon: '👑',
        },
        TUTOR: {
            label: 'Tutor',
            bgColor: 'bg-blue-600',
            textColor: 'text-white',
            icon: '🎓',
        },
        STUDENT_PRO: {
            label: 'Estudiante Pro',
            bgColor: 'bg-purple-600',
            textColor: 'text-white',
            icon: '⭐',
        },
        STUDENT_FREE: {
            label: 'Estudiante',
            bgColor: 'bg-gray-600',
            textColor: 'text-white',
            icon: '📚',
        },
    };

    const config = roleConfig[role] || roleConfig.STUDENT_FREE;

    return (
        <span
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}
        >
            <span>{config.icon}</span>
            <span>{config.label}</span>
        </span>
    );
};

export default RoleBadge;
