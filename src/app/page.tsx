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
  },
  {
    id: 2,
    text: "What challenges are you facing?",
    icon: <MessageSquare className="w-6 h-6 text-blue-400" />,
    type: "textarea",
  },
  {
    id: 3,
    text: "What type of support do you need?",
    icon: <CheckCircle className="w-6 h-6 text-green-400" />,
    type: "text",
  },
  {
    id: 4,
    text: "When would you like to receive check-ins?",
    icon: <Clock className="w-6 h-6 text-yellow-400" />,
    type: "checkbox",
    options: ["Morning", "Evening", "Sunday"],
  },
  {
    id: 5,
    text: "Any preferences for your AI companion?",
    icon: <Sparkles className="w-6 h-6 text-purple-400" />,
    type: "text",
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const router = useRouter();
  const current = questions.find((q) => q.id === step);

  const handleNext = () => {
    if (step < questions.length) setStep(step + 1);
    else alert("🎉 Onboarding complete! Thank you for sharing!");

    router.push("/dashboard");
  };

  const handleChange = (value: any) => {
    setAnswers({ ...answers, [current?.text || ""]: value });
  };
  localStorage.setItem("OnBoarding", JSON.stringify(answers));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-black text-white relative overflow-hidden">
      {/* glowing circles */}
      <div className="absolute inset-0 blur-3xl opacity-30">
        <div className="w-96 h-96 bg-pink-500/20 rounded-full absolute -top-20 -left-20" />
        <div className="w-96 h-96 bg-blue-500/20 rounded-full absolute bottom-0 right-0" />
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
        </div>

        <div className="flex justify-center mb-4">{current?.icon}</div>

        <h2 className="text-2xl font-semibold mb-6">{current?.text}</h2>

        {/* Input */}
        {current?.type === "text" && (
          <input
            type="text"
            onChange={(e) => handleChange(e.target.value)}
            className="w-full p-3 rounded-xl bg-white/20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Type your answer..."
          />
        )}

        {current?.type === "textarea" && (
          <textarea
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

        <motion.button
          onClick={handleNext}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={clsx(
            "mt-8 px-6 py-3 rounded-full font-semibold transition-all",
            "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/60"
          )}
        >
          {step < questions.length ? "Next →" : "Finish 🎉"}
        </motion.button>
      </motion.div>
    </div>
  );
}
