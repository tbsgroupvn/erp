/**
 * LoginScreen — man hinh dang nhap
 *
 * Flow:
 * 1. Nhap email + mat khau
 * 2. Goi auth.login()
 * 3. Goi onLoginSuccess() → AppNavigator tu checkAuth() va dieu huong
 * 4. Hien loi ro rang neu dang nhap that bai
 *
 * Props:
 * - onLoginSuccess: callback sau khi login thanh cong
 *   AppNavigator truyen vao de trigger checkAuth va re-render
 *
 * FIX: Them mounted ref de tranh setState sau khi component da unmount
 * (truong hop user navigate di trong khi dang request)
 */
import React, {useState, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import {login, UserInfo} from '../services/auth';

interface Props {
  onLoginSuccess?: () => void;
}

// Role duoc phep su dung app mobile
const ALLOWED_ROLES = ['DRIVER', 'WAREHOUSE_CN_AGENT', 'WAREHOUSE_VN_MANAGER', 'WAREHOUSE_VN_STAFF'];

export default function LoginScreen({onLoginSuccess}: Props): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);

  // FIX: Dung ref de tranh setState tren unmounted component
  const mountedRef = useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleLogin = useCallback(async () => {
    // Validation co ban
    if (!email.trim()) {
      setErrorMsg('Vui long nhap email');
      return;
    }
    if (!password) {
      setErrorMsg('Vui long nhap mat khau');
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      const user: UserInfo = await login(email.trim().toLowerCase(), password);

      // Kiem tra component con mount khong truoc khi setState
      if (!mountedRef.current) {
        return;
      }

      // Kiem tra role co duoc phep dung app mobile khong
      if (!ALLOWED_ROLES.includes(user.role)) {
        Alert.alert(
          'Khong co quyen truy cap',
          'Tai khoan cua ban khong duoc phep su dung ung dung di dong TBS.',
          [{text: 'Dong'}],
        );
        return;
      }

      // AppNavigator se tu dong checkAuth() va re-render dung tab
      onLoginSuccess?.();
    } catch (err) {
      if (!mountedRef.current) {
        return;
      }
      const message =
        err instanceof Error ? err.message : 'Dang nhap that bai. Vui long thu lai.';
      setErrorMsg(message);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [email, password, onLoginSuccess]);

  const handleEmailChange = useCallback((text: string) => {
    setEmail(text);
    setErrorMsg(null);
  }, []);

  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
    setErrorMsg(null);
  }, []);

  const togglePasswordVisible = useCallback(() => {
    setPasswordVisible(v => !v);
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        {/* Logo / Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>TBS</Text>
          <Text style={styles.title}>ERP Mobile</Text>
          <Text style={styles.subtitle}>Danh cho tai xe & nhan vien kho</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={handleEmailChange}
            placeholder="email@tbs-erp.vn"
            placeholderTextColor="#BDBDBD"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            returnKeyType="next"
            accessibilityLabel="Nhap email"
            editable={!loading}
          />

          {/* Mat khau */}
          <Text style={styles.label}>Mat khau</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={handlePasswordChange}
              placeholder="........"
              placeholderTextColor="#BDBDBD"
              secureTextEntry={!passwordVisible}
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              accessibilityLabel="Nhap mat khau"
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={togglePasswordVisible}
              accessibilityLabel={passwordVisible ? 'An mat khau' : 'Hien mat khau'}
              disabled={loading}>
              <Text style={styles.eyeText}>{passwordVisible ? 'AN' : 'XEM'}</Text>
            </TouchableOpacity>
          </View>

          {/* Error message */}
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Nut dang nhap */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Dang nhap">
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Dang nhap</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>TBS ERP v1.0 — Kho & Van chuyen</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 52,
    fontWeight: '900',
    color: '#1565C0',
    letterSpacing: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#757575',
    marginTop: 6,
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    color: '#1A1A2E',
    backgroundColor: '#FAFAFA',
  },
  passwordWrapper: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 60,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  eyeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1565C0',
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  errorText: {
    color: '#C62828',
    fontSize: 13,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#1565C0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    backgroundColor: '#90CAF9',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footer: {
    textAlign: 'center',
    color: '#BDBDBD',
    fontSize: 12,
    marginTop: 32,
  },
});
