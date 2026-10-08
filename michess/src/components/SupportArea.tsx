import React, { useState, useEffect } from 'react';
import { ArrowLeft, LifeBuoy, Mail, MessageSquare, Send, User } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useAuth } from '../hooks/useAuth';

interface SupportAreaProps {
  onExit: () => void;
}

export const SupportArea: React.FC<SupportAreaProps> = ({ onExit }) => {
  const { user } = useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // Keep email synced if user loads late
  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user]);

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

          <form 
            action="https://formsubmit.co/michess.support@gmail.com" 
            method="POST" 
            className="space-y-6"
          >
            {/* FormSubmit Configuration */}
            <input type="hidden" name="_next" value={window.location.href} />
            <input type="hidden" name="_captcha" value="false" />
            <input type="hidden" name="_subject" value={`Michess Support: ${subject || 'New Message'}`} />
            <input type="hidden" name="_template" value="box" />

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
              />
            </div>

            <div className="pt-2">
              <Button type="submit" fullWidth>
                <Send size={18} className="mr-2" /> Send Message
              </Button>
              <p className="text-center text-xs text-content-3 mt-4">
                Powered by FormSubmit. Replies will be sent to your email.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
