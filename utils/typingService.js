import { createClient } from './supabase/client';

const supabase = createClient();

export const typingService = {
  async insertTypingStatus(userId, username) {
    try {
      if (!userId || !username) {
        console.log('Missing userId or username');
        return { data: null, error: new Error('Missing userId or username') };
      }

      console.log('Inserting typing status for:', username);
      
      // First try to delete any existing status
      await this.deleteTypingStatus(userId);

      // Then insert the new status
      const { data, error } = await supabase
        .from('typing')
        .insert([{
          user_id: userId,
          username: username,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('Error details:', error);
        throw error;
      }
      
      console.log('Successfully inserted typing status');
      return { data, error: null };
    } catch (error) {
      console.error('Error inserting typing status:', error);
      return { data: null, error };
    }
  },

  async deleteTypingStatus(userId) {
    try {
      if (!userId) {
        console.log('Missing userId');
        return { error: null };
      }

      // Get current typing status first
      const { data: currentStatus } = await supabase
        .from('typing')
        .select('username')
        .eq('user_id', userId)
        .maybeSingle(); // Use maybeSingle instead of single to handle missing records

      // Then delete
      const { error } = await supabase
        .from('typing')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting typing status:', error);
        throw error;
      }
      
      const username = currentStatus?.username || 'unknown user';
      console.log('Successfully deleted typing status for:', username);
      return { error: null, username };
    } catch (error) {
      console.error('Error in deleteTypingStatus:', error);
      return { error };
    }
  },

  async fetchTypingStatuses() {
    try {
      const { data, error } = await supabase
        .from('typing')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching typing statuses:', error);
      return { data: null, error };
    }
  }
};
