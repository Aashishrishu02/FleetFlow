import { SetMetadata } from '@nestjs/common';
import { RoleName } from '../constants/roles.enum.js';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: (RoleName | string)[]) => SetMetadata(ROLES_KEY, roles);

