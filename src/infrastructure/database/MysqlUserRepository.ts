import { UserRepository } from '../../domain/repositories/UserRepository';
import { User } from '../../domain/entities/User';
import { queryGet, queryRun } from './mysql';

export class MysqlUserRepository implements UserRepository {
  public async findById(id: string): Promise<User | null> {
    const row = await queryGet<any>('SELECT * FROM users WHERE id = ?', [id]);
    if (!row) return null;
    return new User(row.id, row.email, row.password, row.name, row.role);
  }

  public async findByEmail(email: string): Promise<User | null> {
    const row = await queryGet<any>('SELECT * FROM users WHERE email = ?', [email]);
    if (!row) return null;
    return new User(row.id, row.email, row.password, row.name, row.role);
  }

  public async save(user: User): Promise<void> {
    const existing = await this.findById(user.id);
    if (existing) {
      await queryRun(
        'UPDATE users SET email = ?, password = ?, name = ?, role = ? WHERE id = ?',
        [user.email, user.passwordHash, user.name, user.role, user.id]
      );
    } else {
      await queryRun(
        'INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)',
        [user.id, user.email, user.passwordHash, user.name, user.role]
      );
    }
  }
}
