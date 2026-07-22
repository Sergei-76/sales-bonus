/**  purchase_records чек
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, product) {
  const discount = purchase.discount || 0;
  const discountFactor = 1 - (discount / 100);
  const revenue = purchase.sale_price * purchase.quantity * discountFactor;
  return revenue;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  if (index === 0) {
    // 15% лидеру
    return +(seller.profit * 0.15).toFixed(2);
  } else if (index === 1 || index === 2) {
    // 10% второму и третьему
    return +(seller.profit * 0.10).toFixed(2);
  } else if (index === total - 1) {
    // Последний — 0%
    return 0;
  } else {
    // Все остальные (кроме последнего) — 5%
    return +(seller.profit * 0.05).toFixed(2);
  }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
  // Проверка входных данных
  if (!data || !Array.isArray(data.sellers) || data.sellers.length === 0) {
    throw new Error('Некорректные входные данные: отсутствуют или некорректны sellers');
  }
  if (!Array.isArray(data.products) || data.products.length === 0) {
    throw new Error('Некорректные входные данные: отсутствуют или некорректны products');
  }
  if (!Array.isArray(data.purchase_records) || data.purchase_records.length === 0) {
    throw new Error('Некорректные входные данные: отсутствуют или некорректны purchase_records');
  }

  // Проверка опций
  if (!options || typeof options !== 'object') {
    throw new Error('Опции должны быть объектом');
  }

  const { calculateRevenue, calculateBonus } = options;

  if (typeof calculateRevenue !== 'function') {
    throw new Error('Опция calculateRevenue должна быть функцией');
  }
  if (typeof calculateBonus !== 'function') {
    throw new Error('Опция calculateBonus должна быть функцией');
  }

  // Инициализация статистики продавцов
  const sellerStats = data.sellers.map(seller => ({
    seller_id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {},
    top_products: [], // итоговый топ‑10
    bonus: 0
  }));

  const sellerIndex = Object.fromEntries(
    sellerStats.map(stat => [stat.seller_id, stat])
  );

  const productIndex = Object.fromEntries(
    data.products.map(product => [product.sku, product])
  );

  data.purchase_records.forEach(record => {
    const seller = sellerIndex[record.seller_id];

    if (!seller) {
      console.warn(`Продавец с ID ${record.seller_id} не найден в базе данных`);
      return;
    }

    // Увеличиваем количество продаж
    seller.sales_count += 1;

    record.items.forEach(item => {
      const product = productIndex[item.sku];

      if (!product) {
        console.warn(`Товар с артикулом ${item.sku} не найден`);
        return;
      }

      // Выручка по функции
      const revenue = calculateRevenue(item, product);
      seller.revenue = +(seller.revenue + revenue).toFixed(2);

      // Себестоимость = purchase_price × quantity
      const cost = product.purchase_price * item.quantity;

      // Прибыль = выручка − себестоимость
      const profit = revenue - cost;
      seller.profit = seller.profit + profit;

      // Учёт количества по артикулам
      if (!seller.products_sold[item.sku]) {
        seller.products_sold[item.sku] = 0;
      }
      seller.products_sold[item.sku] += item.quantity;
    });
  });

  sellerStats.sort((a, b) => b.profit - a.profit);

  const totalSellers = sellerStats.length;

  sellerStats.forEach((seller, index) => {
    seller.bonus = calculateBonus(index, totalSellers, seller);
    const topProducts = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    seller.top_products = topProducts;
  });

  return sellerStats.map(seller => ({
    seller_id: seller.seller_id,
    name: seller.name,
    revenue: +seller.revenue.toFixed(2),
    profit: +seller.profit.toFixed(2),
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus: seller.bonus
  }));
}