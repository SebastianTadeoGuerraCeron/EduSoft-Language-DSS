import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
	service: 'gmail', // Puedes usar cualquier servicio de correo electrónico
	auth: {
		user: 'c99652451@gmail.com',
		pass: 'rttr jofk gczq oljm',
	},
	// Configuración explícita de seguridad TLS/SSL
	secure: true, // Usar TLS (true para puerto 465, false para otros puertos con STARTTLS)
	tls: {
		rejectUnauthorized: true, // Rechazar certificados no autorizados
	},
});

 
