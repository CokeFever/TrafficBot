import { RoutineRoute } from '../models/types';
import { DataStore } from './data-store';

export interface RouteService {
  addRoutineRoute(userId: string, route: Omit<RoutineRoute, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string>;
  getRoutineRoutes(userId: string): Promise<RoutineRoute[]>;
  deleteRoutineRoute(userId: string, routeId: string): Promise<void>;
  updateRouteName(userId: string, routeId: string, newName: string): Promise<void>;
}

export class RouteServiceImpl implements RouteService {
  private dataStore: DataStore;
  private readonly MAX_ROUTES = 5;

  constructor(dataStore: DataStore) {
    this.dataStore = dataStore;
  }

  async addRoutineRoute(
    userId: string,
    route: Omit<RoutineRoute, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    // Check route limit
    const existingRoutes = await this.getRoutineRoutes(userId);
    if (existingRoutes.length >= this.MAX_ROUTES) {
      throw new Error('已達到路線數量上限（最多 5 條）');
    }

    // Generate route ID
    const routeId = this.generateId();
    const now = new Date();

    const newRoute: RoutineRoute = {
      id: routeId,
      userId,
      ...route,
      createdAt: now,
      updatedAt: now,
    };

    // Save to data store
    const key = `route:${userId}:${routeId}`;
    await this.dataStore.set(key, newRoute);

    return routeId;
  }

  async getRoutineRoutes(userId: string): Promise<RoutineRoute[]> {
    const prefix = `route:${userId}:`;
    const keys = await this.dataStore.listKeys(prefix);

    if (keys.length === 0) {
      return [];
    }

    const routes = await this.dataStore.batchGet(keys);
    return Object.values(routes).filter((r) => r !== null) as RoutineRoute[];
  }

  async deleteRoutineRoute(userId: string, routeId: string): Promise<void> {
    const key = `route:${userId}:${routeId}`;
    await this.dataStore.delete(key);
  }

  async updateRouteName(
    userId: string,
    routeId: string,
    newName: string
  ): Promise<void> {
    const key = `route:${userId}:${routeId}`;
    const route = await this.dataStore.get(key);

    if (!route) {
      throw new Error('路線不存在');
    }

    route.name = newName;
    route.updatedAt = new Date();

    await this.dataStore.set(key, route);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
