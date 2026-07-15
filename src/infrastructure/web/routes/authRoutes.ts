import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../../../domain/repositories/UserRepository';
import { User } from '../../../domain/entities/User';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_fallback_key';

export function createAuthRouter(userRepository: UserRepository): Router {
  const router = Router();

  // 1. Registro de Usuario
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Todos los campos (email, password, name) son obligatorios.' });
      }

      // Validar si el email ya existe
      const existingUser = await userRepository.findByEmail(email.trim().toLowerCase());
      if (existingUser) {
        return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
      }

      // Encriptar la contraseña
      const passwordHash = bcrypt.hashSync(password, 10);
      const userId = `user-${Date.now()}`;

      // Crear y guardar el usuario
      const newUser = new User(userId, email.trim().toLowerCase(), passwordHash, name.trim(), 'customer');
      await userRepository.save(newUser);

      res.status(201).json({ message: 'Usuario registrado con éxito.' });
    } catch (error: any) {
      console.error('Error en registro:', error);
      res.status(500).json({ error: error.message || 'Error al registrar el usuario.' });
    }
  });

  // 2. Inicio de Sesión (Login)
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email y password son obligatorios.' });
      }

      const user = await userRepository.findByEmail(email.trim().toLowerCase());
      if (!user) {
        return res.status(400).json({ error: 'Credenciales inválidas (correo o contraseña incorrectos).' });
      }

      // Verificar la contraseña
      const isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(400).json({ error: 'Credenciales inválidas (correo o contraseña incorrectos).' });
      }

      // Generar JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error: any) {
      console.error('Error en login:', error);
      res.status(500).json({ error: error.message || 'Error al iniciar sesión.' });
    }
  });

  return router;
}
