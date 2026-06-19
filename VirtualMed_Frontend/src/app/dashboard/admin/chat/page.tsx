'use client';

import { ChatBot } from '@/components/dashboard/ChatBot';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/constants/userRole';

export default function AdminChatPage() {
  const { user } = useAuthStore();

  if (user?.role !== UserRole.ADMIN) {
    return null;
  }

  return (
    <div className="flex h-full w-full flex-col">
      <ChatBot />
    </div>
  );
}
