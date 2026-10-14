import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  X,
  FileCode,
  FolderArchive,
  CheckCircle2,
  Terminal,
  ExternalLink,
  Layers,
  Sparkles,
  ShieldCheck,
  Copy,
  Check
} from 'lucide-react';

interface AndroidStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string) => void;
}

export const AndroidStudioModal: React.FC<AndroidStudioModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [activeCodeTab, setActiveCodeTab] = useState<'main' | 'manifest' | 'gradle'>('main');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen) return null;

  const handleDownloadZip = () => {
    setIsDownloading(true);
    const link = document.createElement('a');
    link.href = '/api/android-project/download-zip';
    link.download = 'InstagramArchiver-AndroidStudio.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onShowToast) {
      onShowToast('Android Studio projesi indiriliyor! Zip dosyasını çıkartıp Android Studio ile açabilirsiniz.');
    }
    setTimeout(() => setIsDownloading(false), 2000);
  };

  const handleCopyCode = (text: string, tabKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabKey);
    setTimeout(() => setCopiedTab(null), 2000);
    if (onShowToast) {
      onShowToast('Kod panoya kopyalandı');
    }
  };

  const codeSnippets = {
    main: `package com.instagram.archiver;

import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends AppCompatActivity {
    private WebView webView;
    private SwipeRefreshLayout swipeRefresh;
    private static final String APP_URL = "http://10.0.2.2:3000";

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        swipeRefresh = findViewById(R.id.swipeRefresh);
        webView = findViewById(R.id.webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        // Native DownloadManager: Doğrudan Android Galerisine İndirme
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            req.setMimeType(mimetype);
            String filename = URLUtil.guessFileName(url, contentDisposition, mimetype);
            req.setTitle(filename);
            req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "InstaFlow/" + filename);
            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            if (dm != null) dm.enqueue(req);
        });

        webView.loadUrl(APP_URL);
    }
}`,
    manifest: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />

    <application
        android:label="InstaFlow"
        android:theme="@style/Theme.InstagramArchiver"
        android:usesCleartextTraffic="true">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            <!-- Instagram OAuth Deep Link: instaflow://oauth-callback -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="instaflow" android:host="oauth-callback" />
            </intent-filter>
        </activity>
    </application>
</manifest>`,
    gradle: `plugins {
    id 'com.android.application'
}

android {
    namespace 'com.instagram.archiver'
    compileSdk 34

    defaultConfig {
        applicationId "com.instagram.archiver"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.swiperefreshlayout:swiperefreshlayout:1.1.0'
    implementation 'androidx.webkit:webkit:1.10.0'
    implementation 'androidx.browser:browser:1.8.0'
}`
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-950/50">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Android Studio Mobil Uygulama</h3>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  Native Java + WebView + DownloadManager
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                InstaFlow'u Android Studio'da açın, APK oluşturup doğrudan Android telefonunuza yükleyin.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Hero Download Card */}
          <div className="bg-gradient-to-r from-emerald-950/50 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <FolderArchive className="w-5 h-5 text-emerald-400" />
                Hazır Android Studio Proje Paketi (.ZIP)
              </h4>
              <p className="text-xs text-slate-300 max-w-md leading-relaxed">
                Gradle 8.2, Android 14 (API 34) SDK, Android DownloadManager (Galeriye doğrudan kaydetme) ve Instagram OAuth Chrome Custom Tabs hazır entegre edilmiştir.
              </p>
            </div>
            <button
              onClick={handleDownloadZip}
              disabled={isDownloading}
              className="w-full md:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer shrink-0 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'İndiriliyor...' : 'Android Studio Projesini İndir (.ZIP)'}</span>
            </button>
          </div>

          {/* 4 Step Setup Guide */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Android Studio'da 4 Kolay Adımda Çalıştırma:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[11px]">1</span>
                  <span>Projeyi Android Studio ile Açın</span>
                </div>
                <p className="text-slate-400 pl-7 leading-relaxed">
                  İndirdiğiniz zip dosyasını klasöre çıkartın. Android Studio açılış ekranında <strong>"Open"</strong> seçip klasörü seçin.
                </p>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[11px]">2</span>
                  <span>Otomatik Gradle Senkronizasyonu</span>
                </div>
                <p className="text-slate-400 pl-7 leading-relaxed">
                  Android Studio açıldığında altta Gradle otomatik olarak kütüphaneleri (AndroidX, Material UI) indirecektir.
                </p>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[11px]">3</span>
                  <span>Telefonda Test Edin (Run)</span>
                </div>
                <p className="text-slate-400 pl-7 leading-relaxed">
                  Telefonunuzu USB ile bağlayın (USB Hata Ayıklama açık) veya Sanal Cihaz (Emülatör) seçip üstteki <strong>"Run" (▶)</strong> butonuna basın.
                </p>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[11px]">4</span>
                  <span>Yüklenebilir APK Dosyası Üretin</span>
                </div>
                <p className="text-slate-400 pl-7 leading-relaxed">
                  Üst menüden <strong>Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)</strong> seçerek tek tıkla <strong>app-debug.apk</strong> dosyasını alın.
                </p>
              </div>
            </div>
          </div>

          {/* Native Mobile Features Badge Matrix */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-3">
            <h5 className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Mobil Uygulamanın Yerel (Native) Güçleri:
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-200 block">Doğrudan Galeriye İndir</strong>
                  <span className="text-slate-400">Android DownloadManager ile fotoğraflar direkt telefona kaydedilir.</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-2">
                <Layers className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-200 block">Instagram OAuth</strong>
                  <span className="text-slate-400">Chrome Custom Tabs ile güvenli şifresiz oturum açma.</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-2">
                <Terminal className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-200 block">Donanım Desteği</strong>
                  <span className="text-slate-400">Geri tuşu, pull-to-refresh ve tam ekran mobil optimizasyon.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Source Code Viewer Tabs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-300">Android Proje Kodlarını İncele:</span>
              </div>
              <button
                onClick={() => handleCopyCode(codeSnippets[activeCodeTab], activeCodeTab)}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                {copiedTab === activeCodeTab ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Kopyalandı!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Kodu Kopyala</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex border-b border-slate-800 bg-slate-950 rounded-t-xl overflow-x-auto">
              <button
                onClick={() => setActiveCodeTab('main')}
                className={`px-3 py-2 text-xs font-mono transition-colors ${
                  activeCodeTab === 'main'
                    ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                MainActivity.java
              </button>
              <button
                onClick={() => setActiveCodeTab('manifest')}
                className={`px-3 py-2 text-xs font-mono transition-colors ${
                  activeCodeTab === 'manifest'
                    ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                AndroidManifest.xml
              </button>
              <button
                onClick={() => setActiveCodeTab('gradle')}
                className={`px-3 py-2 text-xs font-mono transition-colors ${
                  activeCodeTab === 'gradle'
                    ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                app/build.gradle
              </button>
            </div>
            <pre className="p-4 bg-slate-950 border border-t-0 border-slate-800 rounded-b-xl text-slate-300 font-mono text-[11px] overflow-x-auto max-h-56 leading-relaxed">
              <code>{codeSnippets[activeCodeTab]}</code>
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            Dosya boyutu: ~9 KB (Saf Gradle & Java kaynak kodları)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
