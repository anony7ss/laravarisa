'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence, type Variants } from 'framer-motion';

const easeCustom = [0.43, 0.13, 0.23, 0.96] as const;

const containerVariants: Variants = {
  hidden: { 
    opacity: 0,
    y: 24,
  },
  visible: { 
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: easeCustom,
      delayChildren: 0.1,
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { 
    opacity: 0,
    y: 18,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.6,
      ease: easeCustom,
    },
  },
};

const numberVariants: Variants = {
  hidden: (direction: number) => ({
    opacity: 0,
    x: direction * 35,
    y: 10,
    rotate: direction * 4,
  }),
  visible: {
    opacity: 0.85,
    x: 0,
    y: 0,
    rotate: 0,
    transition: {
      duration: 0.8,
      ease: easeCustom,
    },
  },
};

const ghostVariants: Variants = {
  hidden: { 
    scale: 0.85,
    opacity: 0,
    y: 15,
    rotate: -4,
  },
  visible: { 
    scale: 1,
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: {
      duration: 0.6,
      ease: easeCustom,
    },
  },
  hover: {
    scale: 1.12,
    y: -8,
    rotate: [0, -6, 6, -6, 0],
    transition: {
      duration: 0.8,
      ease: 'easeInOut',
      rotate: {
        duration: 2,
        ease: 'linear',
        repeat: Infinity,
        repeatType: 'reverse' as const,
      },
    },
  },
  floating: {
    y: [-6, 6],
    transition: {
      y: {
        duration: 2.2,
        ease: 'easeInOut',
        repeat: Infinity,
        repeatType: 'reverse' as const,
      },
    },
  },
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafaf8] text-[#121211] px-4 selection:bg-[#121211] selection:text-white relative overflow-hidden">
      {/* Luz ambiente de fundo sutil */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none opacity-40 -top-32"
        style={{
          background: 'radial-gradient(circle, rgba(204,163,82,0.18) 0%, rgba(240,240,237,0) 70%)',
        }}
      />

      <AnimatePresence mode="wait">
        <motion.div 
          className="text-center max-w-lg mx-auto relative z-10 py-12"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          {/* Tag de Erro */}
          <motion.div variants={itemVariants} className="mb-4">
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#8c8c84]">
              Erro 404 · Página Inexistente
            </span>
          </motion.div>

          {/* Composição 4 [Ghost] 4 */}
          <div className="flex items-center justify-center gap-3 sm:gap-6 mb-6 sm:mb-8 select-none">
            <motion.span 
              className="text-[90px] sm:text-[130px] font-black text-[#121211] leading-none tracking-tight"
              style={{ fontFamily: 'var(--font-display), sans-serif' }}
              variants={numberVariants}
              custom={-1}
            >
              4
            </motion.span>

            <motion.div
              variants={ghostVariants}
              whileHover="hover"
              animate={["visible", "floating"]}
              className="relative cursor-pointer"
            >
              {/* Glow suave ao redor do fantasma */}
              <div className="absolute inset-0 rounded-full blur-xl bg-black/5 -z-10 scale-90" />
              
              <Image
                src="/ghost.png"
                alt="Fantasma Página 404"
                width={140}
                height={140}
                className="w-[90px] h-[90px] sm:w-[130px] sm:h-[130px] object-contain select-none drop-shadow-md"
                draggable={false}
                priority
              />
            </motion.div>

            <motion.span 
              className="text-[90px] sm:text-[130px] font-black text-[#121211] leading-none tracking-tight"
              style={{ fontFamily: 'var(--font-display), sans-serif' }}
              variants={numberVariants}
              custom={1}
            >
              4
            </motion.span>
          </div>
          
          <motion.h1 
            className="text-2xl sm:text-4xl font-bold text-[#121211] mb-3 tracking-tight"
            variants={itemVariants}
          >
            Boo! Página não encontrada
          </motion.h1>
          
          <motion.p 
            className="text-sm sm:text-base text-[#707068] max-w-sm mx-auto mb-8 sm:mb-10 leading-relaxed"
            variants={itemVariants}
          >
            Ops! Esta página virou um fantasma — ela não existe ou o endereço foi alterado.
          </motion.p>

          {/* Ações */}
          <motion.div 
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <motion.div
              whileHover={{ 
                scale: 1.03,
                transition: { duration: 0.2, ease: easeCustom },
              }}
              whileTap={{ scale: 0.97 }}
            >
              <Link 
                href="/"
                className="inline-flex items-center justify-center px-7 py-3 rounded-full text-xs sm:text-sm font-bold text-white bg-[#121211] hover:bg-neutral-800 transition-all shadow-md active:scale-95"
              >
                Voltar ao Início
              </Link>
            </motion.div>

            <motion.div
              whileHover={{ 
                scale: 1.03,
                transition: { duration: 0.2, ease: easeCustom },
              }}
              whileTap={{ scale: 0.97 }}
            >
              <Link 
                href="/agendar"
                className="inline-flex items-center justify-center px-6 py-3 rounded-full text-xs sm:text-sm font-semibold text-[#121211] bg-white border border-[#d6d6cf] hover:border-[#121211] transition-all shadow-xs active:scale-95"
              >
                Agendar Procedimento
              </Link>
            </motion.div>
          </motion.div>

          <motion.div 
            className="mt-8 text-xs text-[#8c8c84]"
            variants={itemVariants}
          >
            <span>Precisa de ajuda? </span>
            <Link
              href="/servicos"
              className="text-[#121211] font-semibold underline hover:opacity-80 transition-opacity"
            >
              Ver serviços
            </Link>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
