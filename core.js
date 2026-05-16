/**
 * RP Companion Next Gen — Core Engine
 * Version: 83.0.0 (Mobile-optimized with LFM2)
 * Uses: Liquid AI LFM2-350M model for fast, local inference
 */
const Core = (function() {
    'use strict';

    // ============================================
    // НАСТРОЙКИ МОДЕЛИ
    // ============================================
    let generator = null;
    let isModelReady = false;
    let isLoading = false;
    let loadProgress = 0;
    
    // Системный промпт для настройки характера бота
    const SYSTEM_PROMPT = `Ты — Лира, дружелюбный и заботливый помощник. Ты разговариваешь с пользователем на русском языке. Отвечай кратко, по делу, с теплотой. Используй смайлики иногда. Твои ответы должны быть полезными и приятными.`;
    
    // ============================================
    // ЗАГРУЗКА МОДЕЛИ LFM2-350M
    // ============================================
    async function loadModel() {
        if (isModelReady) return true;
        if (isLoading) {
            while (isLoading) await new Promise(r => setTimeout(r, 100));
            return isModelReady;
        }
        
        isLoading = true;
        console.log('[Core] Загрузка модели LFM2-350M (отличный выбор для телефона!)...');
        
        try {
            // Ждём загрузку Transformers.js
            while (typeof transformers === 'undefined') {
                await new Promise(r => setTimeout(r, 100));
            }
            
            // Загружаем модель для генерации текста
            // Используем квантованную версию для экономии памяти
            generator = await transformers.pipeline(
                'text-generation',
                'onnx-community/LFM2-350M-GGUF',
                { 
                    dtype: 'q4',  // 4-битное квантование для экономии памяти
                    progress_callback: (progress) => {
                        loadProgress = progress;
                        console.log(`[Core] Загрузка: ${Math.round(progress * 100)}%`);
                    }
                }
            );
            
            isModelReady = true;
            console.log('[Core] Модель LFM2-350M загружена! Память ~579 MB');
            return true;
        } catch(e) {
            console.error('[Core] Ошибка загрузки модели:', e);
            return false;
        } finally {
            isLoading = false;
        }
    }
    
    // ============================================
    // ГЕНЕРАЦИЯ ОТВЕТА
    // ============================================
    async function generateResponse(userMessage, chatHistory = []) {
        if (!isModelReady) {
            const loaded = await loadModel();
            if (!loaded) {
                return getFallbackResponse(userMessage);
            }
        }
        
        try {
            // Формируем промпт с историей диалога
            let prompt = SYSTEM_PROMPT + '\n\n';
            
            // Добавляем последние 5 сообщений для контекста
            const recentHistory = chatHistory.slice(-5);
            for (const msg of recentHistory) {
                prompt += `${msg.role}: ${msg.content}\n`;
            }
            prompt += `user: ${userMessage}\nassistant:`;
            
            // Генерируем ответ
            const result = await generator(prompt, {
                max_new_tokens: 100,
                temperature: 0.7,
                top_p: 0.9,
                do_sample: true,
                repetition_penalty: 1.1
            });
            
            let response = result[0].generated_text;
            // Извлекаем только ответ ассистента
            const assistantPart = response.split('assistant:').pop();
            return assistantPart.trim() || getFallbackResponse(userMessage);
            
        } catch(e) {
            console.error('[Core] Ошибка генерации:', e);
            return getFallbackResponse(userMessage);
        }
    }
    
    // ============================================
    // ЗАПАСНЫЕ ОТВЕТЫ (если модель не загрузилась)
    // ============================================
    function getFallbackResponse(input) {
        const text = input.toLowerCase().trim();
        
        const responses = {
            'привет': 'Привет! Как настроение?',
            'здравствуй': 'Здравствуй! Как дела?',
            'как дела': 'Хорошо, спасибо! А у тебя?',
            'как ты': 'Отлично! А ты как?',
            'кто ты': 'Я Лира, твой помощник.',
            'спасибо': 'Пожалуйста!',
            'пока': 'Пока! Было приятно пообщаться.',
            '?': 'Хороший вопрос.'
        };
        
        for (const key in responses) {
            if (text.indexOf(key) !== -1) {
                return responses[key];
            }
        }
        return 'Понимаю. Расскажи ещё.';
    }
    
    // ============================================
    // ПАМЯТЬ ДИАЛОГА
    // ============================================
    let chatHistory = [];
    let messageCount = 0;
    
    // ============================================
    // API
    // ============================================
    return {
        init: async function() {
            console.log('[Core] Инициализация с LFM2-350M...');
            // Загружаем модель в фоне
            loadModel();
            return true;
        },
        
        respond: async function(input) {
            if (!input || !input.trim()) return { text: '...' };
            
            const userMessage = input.trim();
            
            // Сохраняем в историю
            chatHistory.push({ role: 'user', content: userMessage });
            if (chatHistory.length > 10) chatHistory.shift();
            
            // Генерируем ответ
            let response;
            if (isModelReady) {
                response = await generateResponse(userMessage, chatHistory);
            } else {
                response = getFallbackResponse(userMessage);
                // Если модель ещё грузится, даём знать
                if (loadProgress > 0 && loadProgress < 1) {
                    response = '🔄 Нейросеть загружается... ' + Math.round(loadProgress * 100) + '%\n' + response;
                }
            }
            
            // Сохраняем ответ
            chatHistory.push({ role: 'assistant', content: response });
            messageCount++;
            
            return {
                text: response,
                metadata: {
                    messageCount: messageCount,
                    modelReady: isModelReady,
                    loadProgress: loadProgress
                }
            };
        },
        
        session: {
            start: () => ({ id: Date.now().toString() }),
            getInfo: () => ({ messageCount: messageCount })
        },
        
        context: {
            getStats: () => ({ messageCount: messageCount, historySize: chatHistory.length })
        },
        
        config: {
            get: () => ({ model: 'LFM2-350M', status: isModelReady ? 'loaded' : 'loading' })
        },
        
        // Для совместимости с интерфейсом
        classifier: {
            categorize: (text) => ({ category: 'general', confidence: 0.8 })
        }
    };
})();

// Автозапуск
if (typeof window !== 'undefined') {
    window.Core = Core;
    Core.init();
}
if (typeof module !== 'undefined') module.exports = Core;
