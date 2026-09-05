import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, MailCheck, AlertCircle } from 'lucide-react';
import { UserRole } from '../types';
import { api } from '../services/api';
import { generateAvatar } from '../services/store';

interface AuthProps {
  onLogin: (data: any) => void;
  onNavigateBack: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin, onNavigateBack }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgotPassword'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.CONSUMER);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
        if (authMode === 'login') {
            const user = await api.auth.login(email, password);
            onLogin(user);
        } else {
            const newUser = await api.auth.register({
                name,
                email,
                role,
                verified: false,
                avatarUrl: generateAvatar(name)
            });
            onLogin(newUser);
        }
    } catch (err: any) {
        setError(err.message || 'Authentication failed. Please try again.');
    } finally {
        setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setTimeout(() => {
        setIsLoading(false);
        setResetEmailSent(true);
    }, 1000);
  };
  
  const resetForm = (mode: 'login' | 'register' | 'forgotPassword') => {
    setAuthMode(mode);
    setError('');
    setEmail('');
    setPassword('');
    setName('');
    setResetEmailSent(false);
  }

  const renderAuthForms = () => (
    <>
      <div className="text-center lg:text-left">
        <h2 className="text-3xl font-bold text-white">
          {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="mt-2 text-zinc-400">
          {authMode === 'login' 
            ? 'Enter your details to access your dashboard.' 
            : 'Start your journey with Elysian today.'}
        </p>
      </div>

      <form onSubmit={handleLoginSubmit} className="space-y-6">
        {authMode === 'register' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={`w-full bg-zinc-900 border rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-1 transition-all placeholder:text-zinc-600 ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-zinc-800 focus:border-red-600 focus:ring-red-600'}`} placeholder="John Doe" />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">Username or Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input type="text" required value={email} onChange={(e) => setEmail(e.target.value)} className={`w-full bg-zinc-900 border rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-1 transition-all placeholder:text-zinc-600 ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-zinc-800 focus:border-red-600 focus:ring-red-600'}`} placeholder="Enter your username or email" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`w-full bg-zinc-900 border rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-1 transition-all placeholder:text-zinc-600 ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-zinc-800 focus:border-red-600 focus:ring-red-600'}`} placeholder="••••••••" />
          </div>
        </div>

        {authMode === 'login' && (
           <div className="text-right -mt-4">
             <button type="button" onClick={() => resetForm('forgotPassword')} className="text-xs text-zinc-400 hover:text-red-500 font-medium">Forgot Password?</button>
           </div>
        )}

        {authMode === 'register' && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-zinc-300">I want to join as a:</label>
            <div className="grid grid-cols-2 gap-4"><button type="button" onClick={() => setRole(UserRole.CONSUMER)} className={`p-3 rounded-xl border text-sm font-medium transition-all ${ role === UserRole.CONSUMER ? 'bg-red-600/10 border-red-600 text-red-500' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800' }`}>Viewer / Client</button><button type="button" onClick={() => setRole(UserRole.CREATOR)} className={`p-3 rounded-xl border text-sm font-medium transition-all ${ role === UserRole.CREATOR ? 'bg-red-600/10 border-red-600 text-red-500' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800' }`}>Creator / Professional</button></div>
          </div>
        )}

        {error && (
            <div className="bg-red-900/50 border border-red-500/30 text-red-300 text-sm rounded-xl p-3 text-center flex items-center justify-center animate-fade-in">
                <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                <span>{error}</span>
            </div>
        )}

        <button type="submit" disabled={isLoading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-red-600/20 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">{isLoading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <>{authMode === 'login' ? 'Sign In' : 'Create Account'}<ArrowRight className="w-5 h-5 ml-2" /></>}</button>
      </form>

      {authMode === 'login' && (
        <div className="space-y-4">
        </div>
      )}

      <div className="text-center"><p className="text-zinc-400 text-sm">{authMode === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}<button onClick={() => resetForm(authMode === 'login' ? 'register' : 'login')} className="text-white font-semibold hover:text-red-500 transition-colors">{authMode === 'login' ? 'Sign Up' : 'Sign In'}</button></p></div>
    </>
  );

  const renderForgotPasswordForm = () => (
    <>
      <div className="text-center lg:text-left">
        <h2 className="text-3xl font-bold text-white">Reset Password</h2>
        <p className="mt-2 text-zinc-400">Enter your email to receive a reset link.</p>
      </div>
      <form onSubmit={handleForgotPasswordSubmit} className="space-y-6">
        <div className="space-y-2"><label className="text-sm font-medium text-zinc-300">Email Address</label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`w-full bg-zinc-900 border rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-1 transition-all placeholder:text-zinc-600 ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-zinc-800 focus:border-red-600 focus:ring-red-600'}`} placeholder="name@example.com" /></div></div>
        {error && (
            <div className="bg-red-900/50 border border-red-500/30 text-red-300 text-sm rounded-xl p-3 text-center flex items-center justify-center">
                <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                <span>{error}</span>
            </div>
        )}
        <button type="submit" disabled={isLoading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-red-600/20 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">{isLoading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <>Send Reset Link<ArrowRight className="w-5 h-5 ml-2" /></>}</button>
      </form>
      <div className="text-center"><p className="text-zinc-400 text-sm">Remember your password?{' '}<button onClick={() => resetForm('login')} className="text-white font-semibold hover:text-red-500 transition-colors">Sign In</button></p></div>
    </>
  );
  
  const renderConfirmation = () => (
     <div className="text-center">
        <div className="w-16 h-16 bg-green-600/10 border border-green-600/20 rounded-full flex items-center justify-center mx-auto mb-6"><MailCheck className="w-8 h-8 text-green-500" /></div>
        <h2 className="text-2xl font-bold text-white">Check your inbox</h2>
        <p className="mt-2 text-zinc-400">If an account with that email exists, we've sent a password reset link. Please check your spam folder if you don't see it.</p>
        <button onClick={() => resetForm('login')} className="mt-8 w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors">Back to Sign In</button>
    </div>
  );

  return (
    <div className="min-h-full flex">
      {/* Left Panel - Visual */}
      <div className="hidden lg:flex w-1/2 bg-zinc-900 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-[#27272a] opacity-40"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent"></div>
        <div className="relative z-10 p-12 max-w-lg"><h2 className="text-5xl font-bold text-white mb-6 leading-tight">Unleash Your <br /><span className="text-red-600">Creative Potential</span></h2><p className="text-xl text-zinc-300 mb-8 leading-relaxed">Join the premier community for high-fidelity media content and professional talent discovery.</p></div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 bg-zinc-950 relative">
         <button onClick={onNavigateBack} className="absolute top-8 right-8 text-zinc-500 hover:text-white transition-colors text-sm">Continue as Guest</button>
         <div className="w-full max-w-md space-y-8">
            {resetEmailSent ? renderConfirmation() : authMode === 'forgotPassword' ? renderForgotPasswordForm() : renderAuthForms()}
         </div>
      </div>
    </div>
  );
};

export default Auth;