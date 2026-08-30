import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Login Presenter - Handles business logic for login
export const useLogin = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  
  const { login, loginWithGoogle, loading } = useAuth();
  const navigate = useNavigate();

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const result = await login(formData.email, formData.password);

    if (result.success) {
      navigate('/dashboard');
      return;
    }

    // 401 is the only thing the API returns when the email/password check
    // fails. Say that plainly rather than passing the raw error through.
    if (result.status === 401) {
      setErrors({
        general: 'Incorrect email or password. Please try again.',
      });
      return;
    }

    const message = result.error || 'Login failed';
    const nextErrors = { general: message };

    // Field-level messages only make sense for the server's own validation
    // errors; anything else belongs in the banner alone.
    if (result.status === 400) {
      if (message.toLowerCase().includes('email')) {
        nextErrors.email = message;
      }

      if (message.toLowerCase().includes('password')) {
        nextErrors.password = message;
      }
    }

    setErrors(nextErrors);
  };

  const handleGoogleLogin = async () => {
    setErrors({});
    const result = await loginWithGoogle();
    if (!result.success) {
      setErrors({ general: result.error || "Google login failed" });
    }
  };

  return {
    formData,
    errors,
    loading,
    handleInputChange,
    handleLogin,
    handleGoogleLogin
  };
};
