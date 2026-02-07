"use client";

// Simple Observer pattern using BroadcastChannel for Cross-Tab Communication
// This simulates Supabase Realtime for the local demo.

export const realtimeService = {
    channel: typeof window !== 'undefined' ? new BroadcastChannel('pide-ya-updates') : null,

    sendUpdate(phoneNumber: string, newStamps: number) {
        if (this.channel) {
            this.channel.postMessage({ type: 'UPDATE_STAMPS', phoneNumber, newStamps });
        }
    },

    sendReward(phoneNumber: string) {
        if (this.channel) {
            this.channel.postMessage({ type: 'REWARD_UNLOCKED', phoneNumber });
        }
    },

    subscribe(onMessage: (data: any) => void) {
        if (this.channel) {
            this.channel.onmessage = (event) => {
                onMessage(event.data);
            };
        }
        return () => {
            // Cleanup if needed
        };
    }
};
