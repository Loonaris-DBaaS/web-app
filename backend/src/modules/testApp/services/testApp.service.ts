import prisma from '@/db';
import type { TestApp } from '@/generated/prisma/client';

export type { TestApp };

export async function list(): Promise<TestApp[]> {
  return prisma.testApp.findMany({ orderBy: { id: 'asc' } });
}

export async function get(id: number): Promise<TestApp | null> {
  return prisma.testApp.findUnique({ where: { id } });
}

export async function create(name: string): Promise<TestApp> {
  return prisma.testApp.create({ data: { name } });
}

export async function update(id: number, name: string): Promise<TestApp | null> {
  try {
    return await prisma.testApp.update({ where: { id }, data: { name } });
  } catch {
    return null;
  }
}

export async function remove(id: number): Promise<boolean> {
  try {
    await prisma.testApp.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
