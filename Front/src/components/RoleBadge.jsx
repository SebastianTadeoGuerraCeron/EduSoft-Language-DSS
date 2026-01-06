import AdminIcon from './icons/AdminIcon';
import TutorIcon from './icons/TutorIcon';
import StarIcon from './icons/StarIcon';
import BookIcon from './icons/BookIcon';

/**
 * Componente para mostrar el badge del rol del usuario
 */
const RoleBadge = ({ role }) => {
    const roleConfig = {
        ADMIN: {
            label: 'Administrador',
            bgColor: 'bg-red-600',
            textColor: 'text-white',
            Icon: AdminIcon,
        },
        TUTOR: {
            label: 'Tutor',
            bgColor: 'bg-blue-600',
            textColor: 'text-white',
            Icon: TutorIcon,
        },
        STUDENT_PRO: {
            label: 'Estudiante Pro',
            bgColor: 'bg-purple-600',
            textColor: 'text-white',
            Icon: StarIcon,
        },
        STUDENT_FREE: {
            label: 'Estudiante',
            bgColor: 'bg-gray-600',
            textColor: 'text-white',
            Icon: BookIcon,
        },
    };

    const config = roleConfig[role] || roleConfig.STUDENT_FREE;
    const IconComponent = config.Icon;

    return (
        <span
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}
        >
            <IconComponent className="w-4 h-4" />
            <span>{config.label}</span>
        </span>
    );
};

export default RoleBadge;
