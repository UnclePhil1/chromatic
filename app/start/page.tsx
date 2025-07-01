"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Wallet,
  Coins,
  Users,
  Trophy,
  ExternalLink,
  ChevronRight,
  CheckCircle,
  ArrowRight,
  Gamepad2,
  Target,
  Zap,
} from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  const steps = [
    {
      id: 1,
      title: "Setup Gorbagana Network",
      description:
        "Configure your Backpack wallet to connect to Gorbagana testnet",
      icon: <Wallet className="w-6 h-6" />,
      action: "Setup Network",
      link: "https://docs.gorbagana.wtf/network-access/connecting-to-testnet.html",
      details: [
        "Open your Backpack wallet",
        "Navigate to network settings",
        "Add Gorbagana testnet RPC",
        "Switch to the new network",
      ],
    },
    {
      id: 2,
      title: "Claim GOR Tokens",
      description: "Get free GOR tokens from the faucet to start betting",
      icon: <Coins className="w-6 h-6" />,
      action: "Get Tokens",
      link: "https://faucet.gorbagana.wtf/",
      details: [
        "Visit the Gorbagana faucet",
        "Connect your wallet",
        "Request GOR tokens",
        "Wait for confirmation",
      ],
    },
    {
      id: 3,
      title: "Start Playing",
      description: "Host a game or join an existing challenge",
      icon: <Play className="w-6 h-6" />,
      action: "Play Now",
      link: "https://khromatic.vercel.app/",
      details: [
        "Connect your Backpack wallet",
        "Choose to host or join a game",
        "Set your bet amount in GOR",
        "Compete to win the prize pool",
      ],
    },
  ];

  const gameFeatures = [
    {
      icon: <Target className="w-8 h-8 text-[#00d4aa]" />,
      title: "Strategic Puzzle",
      description:
        "Organize colored rings into monochromatic towers using strategy and skill",
    },
    {
      icon: <Coins className="w-8 h-8 text-[#00d4aa]" />,
      title: "GOR Token Betting",
      description:
        "Bet GOR tokens and compete for real rewards on Gorbagana testnet",
    },
    {
      icon: <Users className="w-8 h-8 text-[#00d4aa]" />,
      title: "Multiplayer Battles",
      description:
        "Challenge friends or players worldwide in real-time competitions",
    },
    {
      icon: <Zap className="w-8 h-8 text-[#00d4aa]" />,
      title: "Instant Payouts",
      description:
        "Winners receive the entire prize pool directly to their wallet",
    },
  ];

  const gameRules = [
    "Create 4 monochromatic towers (one color per tower)",
    "Leave 1 pole empty for maneuvering",
    "Maximum 4 different colors per pole during gameplay",
    "Maximum 10 rings can be stacked on any pole",
    "Only move the top ring from each pole",
    "First player to complete wins the entire bet pool",
  ];

  return (
    <div className="min-h-screen bg-[#0d0e14]">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00d4aa]/10 via-transparent to-blue-500/10" />
        <div className="relative container mx-auto px-4 py-20">
          <div className="text-center max-w-4xl mx-auto">
            <Badge className="mb-6 bg-[#00d4aa] text-black hover:text-[#00d4aa] px-4 py-2 text-sm font-medium">
              🎮 Powered by Gorbagana Testnet
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Chromatic
              <span className="bg-gradient-to-r from-[#00d4aa] to-blue-400 bg-clip-text text-transparent">
                {" "}
                Rings
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 leading-relaxed">
              The ultimate puzzle game where strategy meets blockchain betting.
              <br />
              Compete with GOR tokens and win big on Gorbagana testnet.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href={"/"}
                className="bg-[#00d4aa] hover:bg-[#00c49a] text-black px-8 py-2 text-lg font-semibold flex items-center flex-row rounded-lg shadow-lg transition-transform transform hover:scale-105"
              >
                <Play className="w-5 h-5 mr-2" />
                Start Playing Now
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Game Features */}
      <div className="py-20 bg-[#1a1b23]/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Why Play Chromatic Rings?
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Experience the perfect blend of puzzle-solving and blockchain
              gaming
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {gameFeatures.map((feature, index) => (
              <Card
                key={index}
                className="bg-[#1a1b23] border-[#2a2d3a] text-center"
              >
                <CardContent className="p-6">
                  <div className="flex justify-center mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-semibold text-white mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Getting Started Guide */}
      <div id="how-to-play" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Get Started in 3 Easy Steps
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Follow this simple guide to start playing and betting with GOR
              tokens
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="space-y-6">
              {steps.map((step, index) => (
                <Card
                  key={step.id}
                  className={`bg-[#1a1b23] border-[#2a2d3a] transition-all duration-300 cursor-pointer ${
                    activeStep === step.id
                      ? "ring-2 ring-[#00d4aa] bg-[#1a1b23]"
                      : "hover:bg-[#1f2028]"
                  }`}
                  onClick={() =>
                    setActiveStep(activeStep === step.id ? null : step.id)
                  }
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 bg-[#00d4aa] rounded-full text-black font-bold">
                          {step.id}
                        </div>
                        <div>
                          <CardTitle className="text-white text-xl">
                            {step.title}
                          </CardTitle>
                          <p className="text-gray-400 mt-1">
                            {step.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {step.link ? (
                          <Button
                            asChild
                            className="bg-[#00d4aa] hover:bg-[#00c49a] text-black"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a
                              href={step.link}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {step.action}
                              <ExternalLink className="w-4 h-4 ml-2" />
                            </a>
                          </Button>
                        ) : (
                          <Button
                            className="bg-[#00d4aa] hover:bg-[#00c49a] text-black"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            {step.action}
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                        <ChevronRight
                          className={`w-5 h-5 text-gray-500 transition-transform ${
                            activeStep === step.id ? "rotate-90" : ""
                          }`}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  {activeStep === step.id && (
                    <CardContent className="pt-0">
                      <div className="ml-16 space-y-3">
                        {step.details.map((detail, detailIndex) => (
                          <div
                            key={detailIndex}
                            className="flex items-center gap-3 text-gray-300"
                          >
                            <CheckCircle className="w-4 h-4 text-[#00d4aa] flex-shrink-0" />
                            <span>{detail}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Game Rules */}
      <div className="py-20 bg-[#1a1b23]/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-white mb-4">Game Rules</h2>
              <p className="text-xl text-gray-400">
                Master these rules to become a Chromatic Rings champion
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="bg-[#1a1b23] border-[#2a2d3a]">
                <CardHeader>
                  <CardTitle className="text-white text-xl flex items-center gap-2">
                    <Target className="w-5 h-5 text-[#00d4aa]" />
                    Objective
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-300 text-lg leading-relaxed">
                    Organize all colored rings into{" "}
                    <strong className="text-white">
                      4 monochromatic towers
                    </strong>{" "}
                    (one color per tower) while leaving{" "}
                    <strong className="text-white">1 pole empty</strong>. The
                    first player to achieve this wins the entire prize pool!
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-[#1a1b23] border-[#2a2d3a]">
                <CardHeader>
                  <CardTitle className="text-white text-xl flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-[#00d4aa]" />
                    Rules
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {gameRules.map((rule, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-3 text-gray-300"
                      >
                        <CheckCircle className="w-4 h-4 text-[#00d4aa] flex-shrink-0 mt-0.5" />
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold text-white mb-6">
              Ready to Start Your Journey?
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              Join thousands of players competing for GOR tokens on the
              Gorbagana testnet. Set up your wallet, claim your tokens, and
              start winning today!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href={"/"}
                className="bg-[#00d4aa] hover:bg-[#00c49a] text-black px-8 py-2 text-lg font-semibold flex items-center flex-row rounded-lg shadow-lg transition-transform transform hover:scale-105"
              >
                <Play className="w-5 h-5 mr-2" />
                Play Chromatic Rings
              </Link>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-[#2a2d3a] text-gray-300 hover:bg-[#2a2d3a] hover:text-white px-8 py-4 text-lg bg-transparent"
              >
                <a
                  href="https://docs.gorbagana.wtf"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-5 h-5 mr-2" />
                  Learn About Gorbagana
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[#2a2d3a] py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-gray-400">
              <p>&copy; 2025 Chromatic Rings. Built on Gorbagana Testnet.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
