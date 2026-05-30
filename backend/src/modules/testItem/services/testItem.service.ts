import prisma from '@/lib/prisma';
import type { TestItem } from '@/generated/prisma/client';

export type { TestItem };

export async function list(): Promise<TestItem[]> {
  return prisma.testItem.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function get(id: string): Promise<TestItem | null> {
  return prisma.testItem.findUnique({ where: { id } });
}

export async function create(data: { title: string; description?: string }): Promise<TestItem> {
  return prisma.testItem.create({ data });
}

export async function update(
  id: string,
  data: { title?: string; description?: string; completed?: boolean },
): Promise<TestItem | null> {
  try {
    return await prisma.testItem.update({ where: { id }, data });
  } catch {
    return null;
  }
}

export async function remove(id: string): Promise<boolean> {
  try {
    await prisma.testItem.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
