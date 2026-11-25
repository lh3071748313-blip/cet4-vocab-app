import React, { useState } from 'react';
import { BookOpen, CheckCircle2, Server, Sparkles } from 'lucide-react';
import { api, getServerUrl, isNativeCapacitor, setServerUrl, setToken } from '../api/client';
import type { User } from '../types';

interface Props {
  onSuccess: (user: User) => void;
}

export const AuthPage: React.FC<Props> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [dailyGoal, setDailyGoal] = useState(20);
  const [serverInput, setServerInput] = useState(getServerUrl());
  const [showServerConfig, setShowServerConfig] = useState(isNativeCapacitor() && !getServerUrl());
  const [serverStatus, setServerStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTestServer = async () => {
    setError(null);
    setServerStatus('正在检测连接...');
    try {
      await api.health(serverInput);
      setServerUrl(serverInput);
      setServerStatus('连接成功！已保存服务器地址');
    } catch {
      setServerStatus(null);
      setError('无法连接到该服务器，请检查 IP/域名、端口及防火墙');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (serverInput.trim()) {
      setServerUrl(serverInput);
    }
    setLoading(true);
    try {
      const res =
        mode === 'login'
          ? await api.login(username, password)
          : await api.register(username, password, dailyGoal);
      setToken(res.access_token);
      onSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 flex flex-col justify-center px-5 py-10">
      <div className="max-w-md w-full mx-auto bg-white rounded-3xl shadow-2xl p-7">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">词跃 CET</h1>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              四六级记忆曲线 · 错题强化
            </p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
              mode === 'login' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'
            }`}
          >
            登录账号
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
              mode === 'register' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'
            }`}
          >
            注册新号
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">用户名</label>
            <input
              type="text"
              required
              minLength={2}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名（2-32位）"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">密码</label>
            <input
              type="password"
              required
              minLength={4}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码（至少4位）"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                每日学习目标：<span className="text-indigo-600 font-semibold">{dailyGoal} 词</span>
              </label>
              <input
                type="range"
                min={10}
                max={80}
                step={5}
                value={dailyGoal}
                onChange={(e) => setDailyGoal(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
          )}

          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-semibold text-sm shadow-lg shadow-indigo-200 transition disabled:opacity-50"
          >
            {loading ? '处理中...' : mode === 'login' ? '登录并开始学习' : '注册并进入学习'}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowServerConfig((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition"
          >
            <Server className="w-3.5 h-3.5" />
            {showServerConfig ? '收起服务器配置' : '安卓 App / 自定义服务器地址设置'}
          </button>

          {showServerConfig && (
            <div className="mt-3 space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <p className="text-[11px] text-slate-500">
                Web 端同域部署留空即可；安卓 App 请填写你的服务器地址（如 http://你的IP:8000 或 https://域名）
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={serverInput}
                  onChange={(e) => setServerInput(e.target.value)}
                  placeholder="http://123.45.67.89:8000"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleTestServer}
                  className="px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-medium whitespace-nowrap"
                >
                  测试连接
                </button>
              </div>
              {serverStatus && (
                <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {serverStatus}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
