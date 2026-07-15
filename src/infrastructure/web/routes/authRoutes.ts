import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../../../domain/repositories/UserRepository';
import { User } from '../../../domain/entities/User';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import { queryAll, queryRun } from '../../database/mysql';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_fallback_key';

export function createAuthRouter(userRepository: UserRepository): Router {
  const router = Router();

  const getStoreId = (req: Request) => String(req.headers['x-store-id'] || req.query.storeId || process.env.DEFAULT_STORE_ID || 'tienda1');

  // 1. Registro de Usuario
  router.post('/register', async (req: Request, res: Response) => {
    if (process.env.DISABLE_REGISTRATION !== 'false') {
      return res.status(503).json({ error: 'El registro de nuevos usuarios está deshabilitado temporalmente.' });
    }

    try {
      const { email, password, name } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Todos los campos (email, password, name) son obligatorios.' });
      }

      // Validar si el email ya existe en esta tienda
      const storeId = getStoreId(req);
      const existingUser = await userRepository.findByEmail(email.trim().toLowerCase(), storeId);
      if (existingUser) {
        return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
      }

      // Encriptar la contraseña
      const passwordHash = bcrypt.hashSync(password, 10);
      const userId = `user-${Date.now()}`;

      // Crear y guardar el usuario
      const newUser = new User(userId, email.trim().toLowerCase(), passwordHash, name.trim(), 'customer');
      await userRepository.save(newUser, storeId);

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

      const storeId = getStoreId(req);
      const user = await userRepository.findByEmail(email.trim().toLowerCase(), storeId);
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

  // 3. Obtener todos los usuarios registrados (solo para Admin)
  router.get('/users', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado.' });
      }
      const rows = await queryAll<{ id: string; email: string; name: string; role: string }>(
        'SELECT id, email, name, role FROM users ORDER BY name ASC'
      );
      res.json(rows);
    } catch (error: any) {
      console.error('Error obteniendo usuarios:', error);
      res.status(500).json({ error: error.message || 'Error al obtener usuarios.' });
    }
  });

  // API 2: Eliminar un Usuario Registrado (solo para Admin)
  router.delete('/users/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado.' });
      }

      const userId = req.params.id;
      
      // Validar que no se auto-elimine el administrador semilla
      const user = await queryAll<any>('SELECT email FROM users WHERE id = ?', [userId]);
      if (user.length > 0 && user[0].email === 'admin@tecnonova.com') {
        return res.status(400).json({ error: 'No se puede eliminar la cuenta principal de administrador.' });
      }

      await queryRun('DELETE FROM users WHERE id = ?', [userId]);
      res.json({ success: true, message: 'Usuario eliminado correctamente.' });
    } catch (error: any) {
      console.error('Error eliminando usuario:', error);
      res.status(500).json({ error: error.message || 'Error al eliminar usuario.' });
    }
  });

  return router;
}
