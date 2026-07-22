/**  purchase_records чек
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
  const { discount = 0, sale_price, quantity } = purchase;

  // Расчёт выручки: цена × количество × (1 − скидка/100)
  const revenue = sale_price * quantity * (1 - (discount / 100));

  // Округление до копеек (2 знака после запятой)
  return Math.round(revenue * 100) / 100;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    // @TODO: Расчет бонуса от позиции в рейтинге
    const { profit } = seller;

     if (index === 0) {
        return 0.15; // 15 %
     }
     else if (index === 1 || index === 2) {
        return 0.1; // 10 %
     }
     else if (index === total-1) {
        return 0 // 0 %
     }
     else {
        return 0.05 // 5 %
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
  const {
    calculateRevenue = calculateSimpleRevenue,
    calculateBonus = calculateBonusByProfit
  } = options || {};

  if (typeof calculateRevenue !== 'function') {
    throw new Error('Опция calculateRevenue должна быть функцией');
  }
  if (typeof calculateBonus !== 'function') {
    throw new Error('Опция calculateBonus должна быть функцией');
  }

  // Индексация: Map для быстрого поиска по ID и SKU
  const sellersMap = new Map(data.sellers.map(seller => [seller.id, seller]));
  const productsMap = new Map(data.products.map(product => [product.sku, product]));

  // Инициализация статистики продавцов
  const sellerStats = data.sellers.map(seller => ({
    seller_id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {}, // объект: { sku: quantity }, а не массив
    top_products: [], // итоговый топ‑10
    bonus: 0
  }));

  const statsMap = new Map(sellerStats.map(stat => [stat.seller_id, stat]));

  // Обработка записей о продажах
  data.purchase_records.forEach(record => {
    const sellerId = record.seller_id;
    const sellerStat = statsMap.get(sellerId);

    if (!sellerStat) {
      console.warn(`Продавец с ID ${sellerId} не найден в базе данных`);
      return;
    }

    record.items.forEach(item => {
      const { sku, discount = 0, quantity, sale_price } = item;
      const product = productsMap.get(sku);

      if (!product) {
        console.warn(`Товар с артикулом ${sku} не найден`);
        return;
      }

      // Расчёт выручки
      const revenue = calculateRevenue(item, product);
      sellerStat.revenue = Math.round((sellerStat.revenue + revenue) * 100) / 100;

      // Расчёт прибыли
      const cost = product.purchase_price || 0;
      const profit = revenue - (cost * quantity);
      sellerStat.profit = Math.round((sellerStat.profit + profit) * 100) / 100;

      // Учёт количества продаж
      sellerStat.sales_count += quantity;

      // Накопление количества по артикулам
      if (!sellerStat.products_sold[sku]) {
        sellerStat.products_sold[sku] = 0;
      }
      sellerStat.products_sold[sku] += quantity;
    });
  });

  // Формирование топ‑10 товаров для каждого продавца
  sellerStats.forEach(seller => {
    const sortedProducts = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
    seller.top_products = sortedProducts;
  });

  // Сортировка продавцов по прибыли (убывание)
  const sortedStats = [...sellerStats].sort((a, b) => b.profit - a.profit);

  // Назначение премий
  sortedStats.forEach((seller, index) => {
    seller.bonus = calculateBonus(index, sortedStats.length, seller);
  });

  // Финальный результат
  return sortedStats.map(seller => ({
    seller_id: seller.seller_id,
    name: seller.name,
    revenue: Math.round(seller.revenue * 100) / 100,
    profit: Math.round(seller.profit * 100) / 100,
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus: Math.round(seller.profit * seller.bonus * 100) / 100
  }));
}


