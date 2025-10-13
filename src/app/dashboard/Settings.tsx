"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User,
  Phone,
  Clock,
  Shield,
  Save,
  Bell,
  Globe,
  Heart,
  MessageSquare,
  CheckCircle,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  timezone: string;
  onboardingAnswers: {
    [key: string]: any;
  };
  preferences: {
    checkIns: string[];
    callReminders: boolean;
    moodTracking: boolean;
  };
}

export default function SettingsProfile() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");

  const [profile, setProfile] = useState<UserProfile>({
    id: "user_" + Date.now(),
    name: "",
    email: "",
    phone: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    onboardingAnswers: {},
    preferences: {
      checkIns: [],
      callReminders: true,
      moodTracking: true,
    },
  });

  // Load profile data from localStorage
  useEffect(() => {
    const loadProfileData = () => {
      try {
        // Load onboarding answers
        const onboardingData =
          typeof window !== "undefined"
            ? localStorage.getItem("OnBoarding")
            : null;

        if (onboardingData) {
          const answers = JSON.parse(onboardingData);
          setProfile((prev) => ({
            ...prev,
            onboardingAnswers: answers,
          }));
        }

        // Load user profile if exists
        const userProfile =
          typeof window !== "undefined"
            ? localStorage.getItem("userProfile")
            : null;

        if (userProfile) {
          const savedProfile = JSON.parse(userProfile);
          setProfile((prev) => ({ ...prev, ...savedProfile }));
        }
      } catch (error) {
        console.error("Error loading profile data:", error);
      }
    };

    loadProfileData();
  }, []);

  const timezones = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
    "Australia/Sydney",
  ];

  const onboardingQuestions = [
    "What brings you here today?",
    "What challenges are you facing?",
    "What type of support do you need?",
    "When would you like to receive check-ins?",
    "Any preferences for your AI companion?",
  ];

  const handleInputChange = (field: string, value: any) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePreferenceChange = (
    field: keyof UserProfile["preferences"],
    value: any
  ) => {
    setProfile((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [field]: value,
      },
    }));
  };

  const handleCheckInToggle = (time: string) => {
    setProfile((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        checkIns: prev.preferences.checkIns.includes(time)
          ? prev.preferences.checkIns.filter((t) => t !== time)
          : [...prev.preferences.checkIns, time],
      },
    }));
  };

  const handleOnboardingAnswerChange = (question: string, value: string) => {
    setProfile((prev) => ({
      ...prev,
      onboardingAnswers: {
        ...prev.onboardingAnswers,
        [question]: value,
      },
    }));
  };

  const triggerWebhook = async (
    type: "onboarding" | "settings" | "call",
    data: any
  ) => {
    const webhookUrls = {
      onboarding: process.env.NEXT_PUBLIC_N8N_ONBOARDING_WEBHOOK,
      settings: process.env.NEXT_PUBLIC_N8N_SETTINGS_WEBHOOK,
      call: process.env.NEXT_PUBLIC_N8N_CALL_WEBHOOK,
    };

    try {
      const response = await fetch(webhookUrls[type]!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: profile.id,
          timestamp: new Date().toISOString(),
          type,
          ...data,
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error(`Webhook error (${type}):`, error);
      return false;
    }
  };

  const handleSaveChanges = async () => {
    setIsLoading(true);
    setSaveStatus("saving");

    try {
      // Save to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("userProfile", JSON.stringify(profile));
      }

      // Trigger settings webhook
      const webhookSuccess = await triggerWebhook("settings", {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        timezone: profile.timezone,
        preferences: profile.preferences,
        updatedOnboardingAnswers: profile.onboardingAnswers,
      });

      if (webhookSuccess) {
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      setSaveStatus("error");
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
      },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-60 -right-20 w-60 h-60 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute -bottom-20 left-1/3 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-500" />
        <div className="absolute top-1/2 right-1/4 w-40 h-40 bg-cyan-500/20 rounded-full blur-2xl animate-bounce" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-200"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-400 to-cyan-400 bg-clip-text text-transparent">
              Profile Settings
            </h1>
            <p className="text-gray-300 mt-2">
              Manage your account and preferences
            </p>
          </div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          {/* Left Column - Personal Info */}
          <motion.div
            variants={itemVariants}
            className="lg:col-span-2 space-y-6"
          >
            {/* Account Information Card */}
            <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-6 shadow-2xl glow">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-blue-500/20">
                  <User className="w-6 h-6 text-blue-300" />
                </div>
                <h2 className="text-2xl font-semibold">Account Information</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) =>
                        handleInputChange("phone", e.target.value)
                      }
                      className="w-full p-3 pl-10 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Timezone
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <select
                      value={profile.timezone}
                      onChange={(e) =>
                        handleInputChange("timezone", e.target.value)
                      }
                      className="w-full p-3 pl-10 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200 appearance-none"
                    >
                      {timezones.map((tz) => (
                        <option key={tz} value={tz} className="bg-gray-800">
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Onboarding Responses Card */}
            <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-6 shadow-2xl glow">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-green-500/20">
                  <MessageSquare className="w-6 h-6 text-green-300" />
                </div>
                <h2 className="text-2xl font-semibold">Your Responses</h2>
              </div>

              <div className="space-y-4">
                {onboardingQuestions.map((question, index) => (
                  <div key={index} className="bg-white/5 rounded-xl p-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {question}
                    </label>
                    {question ===
                    "When would you like to receive check-ins?" ? (
                      <div className="flex flex-wrap gap-2">
                        {["Morning", "Evening", "Sunday"].map((time) => (
                          <button
                            key={time}
                            onClick={() => {
                              const currentAnswers =
                                profile.onboardingAnswers[question] || {};
                              handleOnboardingAnswerChange(question, {
                                ...currentAnswers,
                                [time]: !currentAnswers[time],
                              });
                            }}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                              profile.onboardingAnswers[question]?.[time]
                                ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30"
                                : "bg-white/10 text-gray-300 hover:bg-white/20"
                            }`}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        value={profile.onboardingAnswers[question] || ""}
                        onChange={(e) =>
                          handleOnboardingAnswerChange(question, e.target.value)
                        }
                        rows={2}
                        className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                        placeholder="Your response..."
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right Column - Preferences */}
          <motion.div variants={itemVariants} className="space-y-6">
            {/* Preferences Card */}
            <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-6 shadow-2xl glow">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-purple-500/20">
                  <Bell className="w-6 h-6 text-purple-300" />
                </div>
                <h2 className="text-2xl font-semibold">Preferences</h2>
              </div>

              <div className="space-y-6">
                {/* Check-in Preferences */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-cyan-400" />
                    Check-in Times
                  </h3>
                  <div className="space-y-2">
                    {["Morning", "Evening", "Sunday"].map((time) => (
                      <label
                        key={time}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={profile.preferences.checkIns.includes(time)}
                          onChange={() => handleCheckInToggle(time)}
                          className="w-4 h-4 text-cyan-500 bg-white/10 border-white/20 rounded focus:ring-cyan-500"
                        />
                        <span className="flex-1">{time} Check-ins</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Other Preferences */}
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-green-400" />
                      <span>Call Reminders</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={profile.preferences.callReminders}
                      onChange={(e) =>
                        handlePreferenceChange(
                          "callReminders",
                          e.target.checked
                        )
                      }
                      className="w-4 h-4 text-cyan-500 bg-white/10 border-white/20 rounded focus:ring-cyan-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Heart className="w-5 h-5 text-pink-400" />
                      <span>Mood Tracking</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={profile.preferences.moodTracking}
                      onChange={(e) =>
                        handlePreferenceChange("moodTracking", e.target.checked)
                      }
                      className="w-4 h-4 text-cyan-500 bg-white/10 border-white/20 rounded focus:ring-cyan-500"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Security Card */}
            <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-6 shadow-2xl glow">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-red-500/20">
                  <Shield className="w-6 h-6 text-red-300" />
                </div>
                <h2 className="text-2xl font-semibold">Security</h2>
              </div>

              <button className="w-full p-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold transition-all duration-200 hover:scale-105 transform">
                Change Password
              </button>
            </div>

            {/* Save Button */}
            <motion.button
              onClick={handleSaveChanges}
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full p-4 rounded-xl font-semibold text-lg transition-all duration-200 shadow-2xl ${
                saveStatus === "success"
                  ? "bg-green-500 hover:bg-green-600"
                  : saveStatus === "error"
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              } flex items-center justify-center gap-3`}
            >
              {saveStatus === "saving" ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : saveStatus === "success" ? (
                <>
                  <CheckCircle className="w-6 h-6" />
                  Saved Successfully!
                </>
              ) : saveStatus === "error" ? (
                <>
                  <span>Error Saving</span>
                </>
              ) : (
                <>
                  <Save className="w-6 h-6" />
                  Save Changes
                </>
              )}
            </motion.button>
          </motion.div>
        </motion.div>
      </div>

      {/* Custom Glow Effect */}
      <style jsx>{`
        .glow {
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.1),
            0 0 40px rgba(59, 130, 246, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .glow:hover {
          box-shadow: 0 0 30px rgba(59, 130, 246, 0.2),
            0 0 60px rgba(59, 130, 246, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
