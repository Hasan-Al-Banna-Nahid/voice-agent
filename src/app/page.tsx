"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  Heart,
  Clock,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import clsx from "clsx";
import { useRouter } from "next/navigation";

const questions = [
  {
    id: 1,
    text: "What brings you here today?",
    icon: <Heart className="w-6 h-6 text-pink-400" />,
    type: "text",
    required: true,
  },
  {
    id: 2,
    text: "What challenges are you facing?",
    icon: <MessageSquare className="w-6 h-6 text-blue-400" />,
    type: "textarea",
    required: true,
  },
  {
    id: 3,
    text: "What type of support do you need?",
    icon: <CheckCircle className="w-6 h-6 text-green-400" />,
    type: "text",
    required: true,
  },
  {
    id: 4,
    text: "When would you like to receive check-ins?",
    icon: <Clock className="w-6 h-6 text-yellow-400" />,
    type: "checkbox",
    options: ["Morning", "Evening", "Sunday"],
    required: false,
  },
  {
    id: 5,
    text: "Any preferences for your AI companion?",
    icon: <Sparkles className="w-6 h-6 text-purple-400" />,
    type: "text",
    required: false,
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const router = useRouter();
  const current = questions.find((q) => q.id === step);

  // Check if current question is answered
  const isCurrentQuestionAnswered = () => {
    if (!current) return false;

    if (current.required) {
      const answer = answers[current.text];

      if (current.type === "checkbox") {
        // For checkboxes, check if at least one option is selected
        return answer && Object.values(answer).some((val) => val === true);
      } else {
        // For text/textarea, check if not empty
        return answer && answer.toString().trim().length > 0;
      }
    }

    return true; // Not required questions are always considered answered
  };

  // Add this function to your onboarding component
  const triggerOnboardingWebhook = async (onboardingData: any) => {
    try {
      const response = await fetch(
        process.env.NEXT_PUBLIC_N8N_ONBOARDING_WEBHOOK!,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: `user_${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: "onboarding",
            ...onboardingData,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error("Onboarding webhook error:", error);
      return false;
    }
  };

  // Update the handleNext function in onboarding to include webhook call
  const handleNext = async () => {
    // ... existing validation code ...

    if (step === questions.length) {
      // All questions completed
      const onboardingData = {
        name: "User Name", // You might want to collect this separately
        email: "user@email.com", // You might want to collect this separately
        phone: "", // You might want to collect this separately
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        onboardingAnswers: answers,
        preferences: {
          checkIns: answers["When would you like to receive check-ins?"] || {},
          callReminders: true,
          moodTracking: true,
        },
      };

      // Save to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("OnBoarding", JSON.stringify(answers));
        localStorage.setItem("userProfile", JSON.stringify(onboardingData));
        localStorage.setItem("onboardingCompleted", "true");
      }

      // Trigger webhook
      await triggerOnboardingWebhook(onboardingData);

      // Redirect to dashboard
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleChange = (value: any) => {
    setAnswers({ ...answers, [current?.text || ""]: value });
  };

  // Calculate progress percentage
  const progress = (step / questions.length) * 100;

  // Check if all required questions are answered
  const allRequiredQuestionsAnswered = questions.every((question) => {
    if (!question.required) return true;

    const answer = answers[question.text];
    if (question.type === "checkbox") {
      return answer && Object.values(answer).some((val) => val === true);
    } else {
      return answer && answer.toString().trim().length > 0;
    }
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-black text-white relative overflow-hidden">
      {/* Glowing circles */}
      <div className="absolute inset-0 blur-3xl opacity-30">
        <div className="w-96 h-96 bg-pink-500/20 rounded-full absolute -top-20 -left-20" />
        <div className="w-96 h-96 bg-blue-500/20 rounded-full absolute bottom-0 right-0" />
      </div>

      {/* Progress bar */}
      <div className="w-80 max-w-md mb-6 bg-white/20 rounded-full h-2 z-10">
        <motion.div
          className="bg-gradient-to-r from-pink-500 to-purple-600 h-2 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <motion.div
        key={step}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.98 }}
        transition={{ duration: 0.4 }}
        className="z-10 p-8 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl max-w-md w-full text-center glow"
      >
        <div className="mb-4 text-sm text-gray-300">
          Question {step} of {questions.length}
          {current?.required && " *"}
        </div>

        <div className="flex justify-center mb-4">{current?.icon}</div>

        <h2 className="text-2xl font-semibold mb-6">{current?.text}</h2>

        {/* Input fields */}
        {current?.type === "text" && (
          <input
            type="text"
            value={answers[current.text] || ""}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full p-3 rounded-xl bg-white/20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Type your answer..."
          />
        )}

        {current?.type === "textarea" && (
          <textarea
            value={answers[current.text] || ""}
            onChange={(e) => handleChange(e.target.value)}
            rows={3}
            className="w-full p-3 rounded-xl bg-white/20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Write your thoughts..."
          />
        )}

        {current?.type === "checkbox" && (
          <div className="flex flex-col items-start space-y-2">
            {current.options?.map((opt) => (
              <label
                key={opt}
                className="flex items-center space-x-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={answers[current.text]?.[opt] || false}
                  onChange={(e) =>
                    handleChange({
                      ...(answers[current.text] || {}),
                      [opt]: e.target.checked,
                    })
                  }
                  className="accent-purple-500 w-4 h-4"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-4 mt-8">
          {step > 1 && (
            <motion.button
              onClick={handleBack}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={clsx(
                "px-6 py-3 rounded-full font-semibold transition-all flex-1",
                "bg-white/20 text-white border border-white/30 hover:bg-white/30"
              )}
            >
              ← Back
            </motion.button>
          )}

          <motion.button
            onClick={handleNext}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={current?.required && !isCurrentQuestionAnswered()}
            className={clsx(
              "px-6 py-3 rounded-full font-semibold transition-all flex-1",
              current?.required && !isCurrentQuestionAnswered()
                ? "bg-gray-500 cursor-not-allowed"
                : "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/60"
            )}
          >
            {step < questions.length
              ? "Next →"
              : allRequiredQuestionsAnswered
              ? "Finish 🎉"
              : "Complete Required Questions"}
          </motion.button>
        </div>

        {/* Required field hint */}
        {current?.required && !isCurrentQuestionAnswered() && (
          <p className="text-sm text-pink-300 mt-4">
            This question is required to continue
          </p>
        )}
      </motion.div>

      {/* Skip option for optional questions */}
      {step === questions.length && !allRequiredQuestionsAnswered && (
        <motion.button
          onClick={() => {
            if (typeof window !== "undefined") {
              localStorage.setItem("OnBoarding", JSON.stringify(answers));
              localStorage.setItem("onboardingCompleted", "true");
            }
            router.push("/dashboard");
          }}
          className="mt-4 text-sm text-gray-300 hover:text-white underline z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Skip remaining optional questions
        </motion.button>
      )}
    </div>
  );
}
