import React, { useState, useEffect } from 'react';
import { ArrowLeft, LifeBuoy, Mail, MessageSquare, Send, User, CheckCircle2, Paperclip, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useAuth } from '../hooks/useAuth';
import emailjs from '@emailjs/browser';
import { supabase } from '../services/supabase';

interface SupportAreaProps {
  onExit: () => void;
}

export const SupportArea: React.FC<SupportAreaProps> = ({ onExit }) => {
  const { user } = useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep email synced if user loads late
  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    // EmailJS environment variables
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    if (!serviceId || !templateId || !publicKey) {
      setError('EmailJS is not configured. Please add VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, and VITE_EMAILJS_PUBLIC_KEY to your .env file or Vercel variables.');
      setLoading(false);
      return;
    }

    try {
      let attachmentUrl = '';
      if (attachment) {
        const fileExt = attachment.name.split('.').pop();
        const userId = user?.id || Math.random().toString(36).substring(2, 15);
        const fileName = `${userId}-${Math.random()}.${fileExt}`;
        
        if (supabase) {
          const { error: uploadError } = await supabase.storage
            .from('support')
            .upload(fileName, attachment);
            
          if (uploadError) {
            console.error("Failed to upload attachment:", uploadError);
            // Proceed anyway but without attachment, or you can throw error
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from('support')
              .getPublicUrl(fileName);
            attachmentUrl = publicUrl;
          }
        }
      }

      const finalMessage = attachmentUrl 
        ? `${message}\n\n[Attachment: ${attachmentUrl}]` 
        : message;

      await emailjs.send(
        serviceId,
        templateId,
        {
          from_name: name,
          reply_to: email,
          subject: subject,
          message: finalMessage,
          attachment_url: attachmentUrl || 'No attachment provided',
        },
        publicKey
      );

      setSuccess(true);
      setName('');
      setSubject('');
      setMessage('');
      setAttachment(null);
      if (!user?.email) setEmail('');
    } catch (err: any) {
      console.error('EmailJS Error:', err);
      setError('Failed to send message. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 h-full flex flex-col py-6">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={onExit} className="pl-0 hover:bg-transparent">
          <ArrowLeft size={20} className="mr-2" /> Back
        </Button>
        <h2 className="text-2xl font-black text-content-1">Support</h2>
        <div className="w-20"></div>
      </div>

      <div className="glass-panel border-none ring-1 ring-border-1/50 rounded-xl p-8 relative overflow-hidden shadow-sm animate-slide-up flex-1">
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-accent/10 via-surface-2/0 to-surface-2/0 z-0 pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mb-4 ring-4 ring-surface-1 shadow-md">
              <LifeBuoy size={32} />
            </div>
            <h1 className="text-3xl font-bold text-content-1 mb-2">How can we help?</h1>
            <p className="text-content-3 max-w-md mx-auto">
              Found a bug? Have a suggestion? Or just want to say hi? Fill out the form below and our team will get back to you.
            </p>
          </div>

          {success ? (
            <div className="bg-success/10 border border-success/30 rounded-2xl p-8 text-center animate-fade-in flex flex-col items-center">
              <CheckCircle2 size={48} className="text-success mb-4" />
              <h3 className="text-xl font-bold text-content-1 mb-2">Message Sent!</h3>
              <p className="text-content-3 mb-6">
                Thanks for reaching out to Michess Support. We'll get back to you at <strong>{user?.email || email}</strong> as soon as possible.
              </p>
              <Button onClick={() => setSuccess(false)}>
                Send another message
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-error/10 border border-error/30 text-error px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input 
                label="Your Name"
                name="name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="John Doe"
                required
                icon={<User size={18} />}
                disabled={loading}
              />
              
              <Input 
                label="Email Address"
                name="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="john@example.com"
                required
                icon={<Mail size={18} />}
                disabled={loading || !!user?.email} // Disable if they are logged in so they don't change their return address
              />
            </div>

            <Input 
              label="Subject"
              name="subject"
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="What is this about?"
              required
              icon={<MessageSquare size={18} />}
              disabled={loading}
            />

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-content-2">
                Message
              </label>
              <textarea 
                name="message"
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full bg-surface-1 border border-border-1 rounded-lg px-4 py-3 text-content-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors resize-y min-h-[150px]"
                placeholder="Describe your issue or feedback in detail..."
                required
                disabled={loading}
              />
            </div>

            <div className="flex items-center gap-4 pt-1">
              {attachment ? (
                <div className="flex items-center gap-2 bg-surface-2 border border-border-1 rounded-lg px-3 py-2 text-sm text-content-2 flex-1 min-w-0">
                  <Paperclip size={14} className="shrink-0" />
                  <span className="truncate">{attachment.name}</span>
                  <button 
                    type="button" 
                    onClick={() => setAttachment(null)}
                    disabled={loading}
                    className="ml-auto text-content-3 hover:text-error transition-colors p-1"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <Button 
                  type="button"
                  variant="secondary" 
                  className="relative overflow-hidden w-full sm:w-auto text-sm h-10"
                  disabled={loading}
                >
                  <input 
                    type="file" 
                    accept="image/*,.pdf,.doc,.docx" 
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          setError('File is too large (max 5MB)');
                        } else {
                          setError(null);
                          setAttachment(file);
                        }
                      }
                    }}
                  />
                  <Paperclip size={16} className="mr-2" /> 
                  Attach File or Image
                </Button>
              )}
            </div>

            <div className="pt-2">
              <Button type="submit" fullWidth disabled={loading}>
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={18} className="mr-2" /> Send Message
                  </>
                )}
              </Button>
              <p className="text-center text-xs text-content-3 mt-4">
                Powered by EmailJS. Replies will be sent to your email.
              </p>
            </div>
          </form>
          )}
        </div>
      </div>
    </div>
  );
};
