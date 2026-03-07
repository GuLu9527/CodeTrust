// AI 生成的代码样本 - 用于测试 CodeTrust 检测能力

// 1. 不必要的 try-catch（AI 常见幻觉）
function processUser(user: any) {
  try {
    const name = user.name;
  } catch (err) {
    console.log(err);
  }

  try {
    const email = user.email;
  } catch (error) {
    console.error(error);
  }
}

// 2. 过度防御性编程
function validateOrder(order: any) {
  if (!order) return;
  if (!order.id) return;
  if (!order.items) return;
  if (!order.total) return;
  if (!order.customer) return;

  // 冗余的 typeof 检查
  const price = order.total;
  if (typeof price === 'undefined') {
    return null;
  }

  return order;
}

// 3. 死逻辑分支
function calculateDiscount(price: number, isVip: boolean) {
  if (true) {
    console.log('This always runs');
  }

  if (false) {
    console.log('This never runs');
  }

  if (null) {
    console.log('Also never runs');
  }

  const discount = isVip ? 0.1 : 0.05;

  // return 后的不可达代码
  return discount;
  console.log('Unreachable code');
}

// 4. 立即重新赋值
function setupConfig() {
  let config = getDefaultConfig();
  config = loadConfig();
  return config;
}

// 5. 混合问题
function handlePayment(payment: any) {
  try {
    const amount = payment.amount;
  } catch (err) {
    console.log(err);
  }

  if (!payment) return;
  if (!payment.id) return;
  if (!payment.amount) return;
  if (!payment.method) return;

  if (true) {
    console.log('Processing payment');
  }

  let status = 'pending';
  status = processPayment(payment);

  return status;
}

// 6. 复杂的嵌套（结构问题）
function complexLogic(data: any) {
  if (data) {
    if (data.items) {
      for (const item of data.items) {
        if (item.type === 'physical') {
          if (item.weight > 10) {
            if (item.requiresShipping) {
              if (item.destination === 'international') {
                if (item.value > 100) {
                  console.log('Heavy international item');
                }
              }
            }
          }
        }
      }
    }
  }
}

// 辅助函数（避免未定义错误）
function getDefaultConfig() {
  return { theme: 'dark', lang: 'en' };
}

function loadConfig() {
  return { theme: 'light', lang: 'zh' };
}

function processPayment(payment: any) {
  return 'processed';
}
