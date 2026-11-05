/* File này được dùng chung cho index.html và admin.html.
-------------------- 1. Dữ liệu dùng chung -------------------- */
var products = [];
var reviews = [];
var productRatings = {};
var PRODUCTS_CACHE_KEY = "bw08_products_xml";

/* Định dạng tiền Việt Nam để hiển thị thống nhất trên giao diện. */
function formatCurrency(number) {
    return Number(number || 0).toLocaleString("vi-VN") + " ₫";
}

/* Lấy nội dung một node XML theo tên thẻ. */
function getXmlText(parent, tagName) {
    var node = parent.getElementsByTagName(tagName)[0];
    return node ? node.textContent.trim() : "";
}

/* Đọc file XML bằng fetch, sau đó chuyển chuỗi XML thành tài liệu DOM. */
function loadXmlFile(filePath) {
    return fetch(filePath)
        .then(function (response) {
            if (!response.ok) {
                throw new Error("Không thể đọc file: " + filePath);
            }
            return response.text();
        })
        .then(function (xmlText) {
            var parser = new DOMParser();
            var xmlDocument = parser.parseFromString(xmlText, "application/xml");
            if (xmlDocument.getElementsByTagName("parsererror").length > 0) {
                throw new Error("Dữ liệu XML không hợp lệ: " + filePath);
            }
            return xmlDocument;
        });
}

/* Chuyển các node Product trong products.xml thành mảng object JavaScript. */
function parseProducts(xmlDocument) {
    var productNodes = xmlDocument.getElementsByTagName("product");
    var result = [];

    for (var i = 0; i < productNodes.length; i++) {
        var node = productNodes[i];
        var colorNodes = node.getElementsByTagName("color");
        var colorList = [];
        var sizeNodes = node.getElementsByTagName("size");
        var sizeList = [];

        for (var j = 0; j < colorNodes.length; j++) {
            colorList.push(colorNodes[j].textContent.trim());
        }
        for (var sizeIndex = 0; sizeIndex < sizeNodes.length; sizeIndex++) {
            sizeList.push(sizeNodes[sizeIndex].textContent.trim());
        }

        result.push({
            id: getXmlText(node, "id"),
            title: getXmlText(node, "title"),
            price: Number(getXmlText(node, "price")),
            category: getXmlText(node, "category"),
            image: getXmlText(node, "image"),
            colors: colorList,
            sizes: sizeList,
            stock: Number(getXmlText(node, "stock")),
            apiRating: getXmlText(node, "api_rating") === ""
                ? null
                : Number(getXmlText(node, "api_rating")),
            description: getXmlText(node, "description")
        });
    }
    return result;
}

/* Chuyển danh sách Fake Store API thành XML bằng DOM, không ghép chuỗi XML thủ công. */
function createProductsXml(apiProducts) {
    var xmlDocument = document.implementation.createDocument("", "products", null);
    var productFragment = xmlDocument.createDocumentFragment();
    var colors = ["Đen", "Trắng", "Xanh", "Be", "Nâu", "Đỏ"];

    for (var i = 0; i < apiProducts.length; i++) {
        var source = apiProducts[i];
        var product = xmlDocument.createElement("product");
        var productId = "P" + String(source.id).padStart(3, "0");
        var category = source.category.toLowerCase().indexOf("jewel") !== -1
            ? "Phụ kiện"
            : source.category.toLowerCase().indexOf("electronics") !== -1
                ? "Phụ kiện"
                : source.category.toLowerCase().indexOf("women") !== -1 ||
                    source.category.toLowerCase().indexOf("men") !== -1
                    ? "Thời trang"
                    : "Thời trang";

        function appendText(parent, tagName, value) {
            var element = xmlDocument.createElement(tagName);
            element.textContent = String(value == null ? "" : value);
            parent.appendChild(element);
            return element;
        }

        appendText(product, "id", productId);
        appendText(product, "title", source.title);
        appendText(product, "price", Math.round(Number(source.price) * 25000));
        appendText(product, "category", category);
        appendText(product, "image", source.image);

        var colorsElement = xmlDocument.createElement("colors");
        var firstColor = (Number(source.id) - 1) % colors.length;
        for (var colorIndex = 0; colorIndex < 3; colorIndex++) {
            appendText(colorsElement, "color", colors[(firstColor + colorIndex) % colors.length]);
        }
        product.appendChild(colorsElement);

        var sizesElement = xmlDocument.createElement("sizes");
        var sizeOptions = category === "Thời trang" ? ["S", "M", "L", "XL"] : ["One size"];
        for (var sizeIndex = 0; sizeIndex < sizeOptions.length; sizeIndex++) {
            appendText(sizesElement, "size", sizeOptions[sizeIndex]);
        }
        product.appendChild(sizesElement);
        appendText(product, "stock", 10 + (Number(source.id) % 40));
        if (source.rating && Number.isFinite(Number(source.rating.rate))) {
            appendText(product, "api_rating", source.rating.rate);
        }
        appendText(product, "description", source.description);
        productFragment.appendChild(product);
    }

    xmlDocument.documentElement.appendChild(productFragment);
    return new XMLSerializer().serializeToString(xmlDocument);
}

/* Lấy API; nếu mất mạng thì dùng XML đã cache hoặc file XML mẫu. */
function loadProductsDocument() {
    return fetch("https://fakestoreapi.com/products")
        .then(function (response) {
            if (!response.ok) throw new Error("Fake Store API trả về HTTP " + response.status);
            return response.json();
        })
        .then(function (apiProducts) {
            if (!Array.isArray(apiProducts) || apiProducts.length === 0) {
                throw new Error("Fake Store API không trả về danh sách sản phẩm hợp lệ.");
            }
            var xmlText = createProductsXml(apiProducts);
            localStorage.setItem(PRODUCTS_CACHE_KEY, xmlText);
            return new DOMParser().parseFromString(xmlText, "application/xml");
        })
        .catch(function (apiError) {
            console.warn("Không tải được sản phẩm từ API, thử dùng dữ liệu XML dự phòng.", apiError);
            var cachedXml = localStorage.getItem(PRODUCTS_CACHE_KEY);
            if (cachedXml) {
                var cachedDocument = new DOMParser().parseFromString(cachedXml, "application/xml");
                if (cachedDocument.getElementsByTagName("parsererror").length === 0) {
                    var cachedProducts = cachedDocument.getElementsByTagName("product");
                    for (var i = 0; i < cachedProducts.length; i++) {
                        var cachedId = cachedProducts[i].getElementsByTagName("id")[0];
                        if (cachedId && /^API-\d+$/.test(cachedId.textContent.trim())) {
                            cachedId.textContent = "P" + cachedId.textContent.trim().slice(4).padStart(3, "0");
                        }
                    }
                    return cachedDocument;
                }
                console.error("XML sản phẩm trong LocalStorage không hợp lệ; đang đọc file mẫu.");
            }
            return loadXmlFile("data/products.xml");
        });
}

/* Đọc review và tính điểm trung bình theo từng product_id. */
function parseReviews(xmlDocument) {
    var reviewNodes = xmlDocument.getElementsByTagName("review");
    var result = [];
    var totalByProduct = {};
    var countByProduct = {};

    for (var i = 0; i < reviewNodes.length; i++) {
        var node = reviewNodes[i];
        var review = {
            review_id: getXmlText(node, "review_id"),
            product_id: getXmlText(node, "product_id"),
            customer_name: getXmlText(node, "customer_name"),
            rating: Number(getXmlText(node, "rating")),
            comment: getXmlText(node, "comment"),
            date: getXmlText(node, "date")
        };

        result.push(review);
        if (!totalByProduct[review.product_id]) {
            totalByProduct[review.product_id] = 0;
            countByProduct[review.product_id] = 0;
        }
        totalByProduct[review.product_id] += review.rating;
        countByProduct[review.product_id] += 1;
    }

    /* Tạo object { mã sản phẩm: điểm trung bình }. */
    for (var productId in totalByProduct) {
        productRatings[productId] = totalByProduct[productId] / countByProduct[productId];
    }
    return result;
}

/* -------------------- 2. State giỏ hàng (Câu 6) -------------------- */
var CartState = {
    items: [],

    /* Đọc giỏ hàng đã lưu để không mất dữ liệu khi tải lại trang. */
    load: function () {
        var savedCart = localStorage.getItem("bw08_cart");
        if (savedCart) {
            try {
                this.items = JSON.parse(savedCart);
            } catch (error) {
                this.items = [];
            }
        }
        this.renderMiniCart();
    },

    /* Tìm sản phẩm theo id và màu. Nếu đã tồn tại thì tăng số lượng. */
    addItem: function (product, variant) {
        var foundItem = null;

        for (var i = 0; i < this.items.length; i++) {
            if (this.items[i].id === product.id && this.items[i].variant === variant) {
                foundItem = this.items[i];
                break;
            }
        }

        if (foundItem) {
            foundItem.quantity += 1;
        } else {
            this.items.push({
                id: product.id,
                title: product.title,
                price: product.price,
                image: product.image,
                variant: variant,
                quantity: 1
            });
        }

        this.save();
        this.renderMiniCart();
    },

    /* Tính tổng số tiền của tất cả dòng sản phẩm trong giỏ. */
    calculateTotal: function () {
        var total = 0;
        for (var i = 0; i < this.items.length; i++) {
            total += this.items[i].price * this.items[i].quantity;
        }
        return total;
    },

    calculateQuantity: function () {
        var quantity = 0;
        for (var i = 0; i < this.items.length; i++) {
            quantity += this.items[i].quantity;
        }
        return quantity;
    },

    save: function () {
        localStorage.setItem("bw08_cart", JSON.stringify(this.items));
    },

    /* Cập nhật đồng thời bảng mini-cart, tổng tiền và số lượng trên header. */
    renderMiniCart: function () {
        var content = document.getElementById("mini-cart-content");
        var totalElement = document.getElementById("cart-total");
        var countElement = document.getElementById("cart-count");

        if (countElement) countElement.textContent = this.calculateQuantity();
        if (totalElement) totalElement.textContent = formatCurrency(this.calculateTotal());
        if (!content) return;

        if (this.items.length === 0) {
            content.innerHTML = '<p class="empty-state">Giỏ hàng hiện đang trống.</p>';
            return;
        }

        var html = '<div class="table-wrap"><table class="cart-table"><thead><tr>' +
            '<th>Sản phẩm</th><th>Biến thể</th><th>Đơn giá</th><th>Số lượng</th><th></th>' +
            '</tr></thead><tbody>';

        for (var i = 0; i < this.items.length; i++) {
            var item = this.items[i];
            html += '<tr>' +
                '<td>' + escapeHtml(item.title) + '</td>' +
                '<td>' + escapeHtml(item.variant) + '</td>' +
                '<td>' + formatCurrency(item.price) + '</td>' +
                '<td><div class="qty-control">' +
                '<button type="button" data-cart-action="decrease" data-index="' + i + '">−</button>' +
                '<span>' + item.quantity + '</span>' +
                '<button type="button" data-cart-action="increase" data-index="' + i + '">+</button>' +
                '</div></td>' +
                '<td><button type="button" class="remove-item" data-cart-action="remove" data-index="' + i + '">Xóa</button></td>' +
                '</tr>';
        }
        html += '</tbody></table></div>';
        content.innerHTML = html;
    },

    changeQuantity: function (index, action) {
        if (!this.items[index]) return;

        if (action === "increase") this.items[index].quantity += 1;
        if (action === "decrease") this.items[index].quantity -= 1;
        if (action === "remove" || this.items[index].quantity <= 0) {
            this.items.splice(index, 1);
        }

        this.save();
        this.renderMiniCart();
    }
};

/* Escape ký tự HTML khi đưa dữ liệu XML/JSON vào innerHTML. */
function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* -------------------- 3. Hiển thị danh sách sản phẩm -------------------- */
function renderProducts(list) {
    var container = document.getElementById("product-list-container");
    var skeleton = document.getElementById("product-skeleton");
    var count = document.getElementById("product-result-count");

    if (!container) return;
    if (skeleton) skeleton.classList.add("hidden");
    container.innerHTML = "";

    if (count) count.textContent = "Tìm thấy " + list.length + " sản phẩm";

    if (list.length === 0) {
        container.innerHTML = '<p class="empty-state">Không tìm thấy sản phẩm phù hợp.</p>';
        return;
    }

    for (var i = 0; i < list.length; i++) {
        var product = list[i];
        var averageRating = productRatings[product.id] || product.apiRating;
        var rating = averageRating ? averageRating.toFixed(1) : "Chưa có";
        var defaultColor = product.colors.length > 0 ? product.colors[0] : "Mặc định";
        var defaultSize = product.sizes.length > 0 ? product.sizes[0] : "";
        var defaultVariant = defaultColor + (defaultSize ? " / " + defaultSize : "");
        var colorOptions = "";
        var sizeOptions = "";
        for (var colorIndex = 0; colorIndex < product.colors.length; colorIndex++) {
            var color = product.colors[colorIndex];
            colorOptions += '<option value="' + escapeHtml(color) + '">' + escapeHtml(color) + '</option>';
        }
        for (var sizeIndex = 0; sizeIndex < product.sizes.length; sizeIndex++) {
            var size = product.sizes[sizeIndex];
            sizeOptions += '<option value="' + escapeHtml(size) + '">' + escapeHtml(size) + '</option>';
        }
        var card = document.createElement("article");
        card.className = "product-card";
        card.innerHTML =
            '<div class="product-image-wrap">' +
                '<span class="rating-badge">★ ' + rating + '</span>' +
                '<img class="product-image" src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.title) + '">' +
            '</div>' +
            '<div class="product-info">' +
                '<span class="product-category">' + escapeHtml(product.category) + '</span>' +
                '<h3>' + escapeHtml(product.title) + '</h3>' +
                '<p class="product-price">' + formatCurrency(product.price) + '</p>' +
                '<p class="product-stock">Còn ' + product.stock + ' sản phẩm</p>' +
                '<div class="variant-selectors">' +
                    (product.colors.length > 0
                        ? '<select class="product-color" aria-label="Chọn màu cho ' + escapeHtml(product.title) + '">' + colorOptions + '</select>'
                        : '') +
                    (product.sizes.length > 0
                        ? '<select class="product-size" aria-label="Chọn kích cỡ cho ' + escapeHtml(product.title) + '">' + sizeOptions + '</select>'
                        : '') +
                '</div>' +
                '<div class="product-actions">' +
                    '<button type="button" class="btn btn-add-cart" data-id="' + escapeHtml(product.id) + '" data-variant="' + escapeHtml(defaultVariant) + '">Thêm vào giỏ hàng</button>' +
                    '<button type="button" class="btn btn-quick-view" data-id="' + escapeHtml(product.id) + '" data-variant="' + escapeHtml(defaultVariant) + '">Xem nhanh</button>' +
                '</div>' +
                '<a class="text-link" href="#" data-action="rating-detail" data-id="' + escapeHtml(product.id) + '">Rating Detail (' + rating + '/5)</a>' +
            '</div>';
        container.appendChild(card);
    }
}

function findProduct(productId) {
    for (var i = 0; i < products.length; i++) {
        if (products[i].id === productId) return products[i];
    }
    return null;
}

function getSelectedVariant(button) {
    var variant = button.getAttribute("data-variant") || "";
    var card = button.closest(".product-card");
    if (!card) return variant;

    var colorSelect = card.querySelector(".product-color");
    var sizeSelect = card.querySelector(".product-size");
    if (colorSelect) variant = colorSelect.value;
    if (sizeSelect) variant += (variant ? " / " : "") + sizeSelect.value;

    var variantButtons = card.querySelectorAll("[data-id][data-variant]");
    for (var i = 0; i < variantButtons.length; i++) {
        variantButtons[i].setAttribute("data-variant", variant);
    }
    return variant;
}

/* -------------------- 4. Event Delegation duy nhất trên product container -------------------- */
function setupProductEventDelegation() {
    var container = document.getElementById("product-list-container");
    if (!container) return;

    /* Chỉ một click listener cho toàn bộ các card sản phẩm.
       closest() giúp nhận đúng nút ngay cả khi người dùng click vào phần tử con bên trong nút. */
    container.addEventListener("click", function (e) {
        if (!e.target.closest) return;
        var addButton = e.target.closest(".btn-add-cart");
        var quickButton = e.target.closest(".btn-quick-view");
        var ratingLink = e.target.closest('[data-action="rating-detail"]');

        if (addButton) {
            var addProduct = findProduct(addButton.getAttribute("data-id"));
            var addVariant = getSelectedVariant(addButton);
            if (addProduct) {
                CartState.addItem(addProduct, addVariant);
                showMessage(addButton, "Đã thêm!");
            }
            return;
        }

        if (quickButton) {
            var quickProduct = findProduct(quickButton.getAttribute("data-id"));
            if (quickProduct) showQuickView(quickProduct, getSelectedVariant(quickButton));
            return;
        }

        if (ratingLink) {
            e.preventDefault();
            showRatingDetails(ratingLink.getAttribute("data-id"));
        }
    });
}

/* -------------------- 5. Quick view và Rating Detail -------------------- */
function showQuickView(product, variant) {
    var overlay = document.getElementById("detail-overlay");
    var title = document.getElementById("detail-title");
    var content = document.getElementById("detail-content");
    if (!overlay || !content) return;

    title.textContent = "Xem nhanh sản phẩm";
    content.innerHTML =
        '<div class="detail-product">' +
            '<img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.title) + '">' +
            '<div><h3>' + escapeHtml(product.title) + '</h3>' +
            '<p class="product-price">' + formatCurrency(product.price) + '</p>' +
            '<p>' + escapeHtml(product.description) + '</p>' +
            '<p><strong>Biến thể:</strong> ' + escapeHtml(variant) + '</p>' +
            '<p><strong>Tồn kho:</strong> ' + product.stock + '</p></div>' +
        '</div>';
    overlay.classList.add("show");
}

function showRatingDetails(productId) {
    var overlay = document.getElementById("detail-overlay");
    var title = document.getElementById("detail-title");
    var content = document.getElementById("detail-content");
    var product = findProduct(productId);
    if (!overlay || !content || !product) return;

    title.textContent = "Đánh giá: " + product.title;
    var matchedReviews = [];

    for (var i = 0; i < reviews.length; i++) {
        if (reviews[i].product_id === productId) matchedReviews.push(reviews[i]);
    }

    if (matchedReviews.length === 0) {
        var noReviewRating = productRatings[productId] || product.apiRating;
        content.innerHTML = '<p class="empty-state">' +
            (noReviewRating
                ? 'Điểm đánh giá từ API: ' + noReviewRating.toFixed(1) + '/5. Chưa có bài đánh giá chi tiết.'
                : 'Sản phẩm chưa có đánh giá.') + '</p>';
    } else {
        var html = '<p><strong>Điểm trung bình: ' +
            (productRatings[productId] ? productRatings[productId].toFixed(1) : "0") + '/5</strong></p>';
        for (var j = 0; j < matchedReviews.length; j++) {
            var review = matchedReviews[j];
            html += '<article class="review-item">' +
                '<div class="review-meta"><strong>' + escapeHtml(review.customer_name) +
                ' - ' + review.rating + '/5 ★</strong><span>' + escapeHtml(review.date) + '</span></div>' +
                '<p>' + escapeHtml(review.comment) + '</p></article>';
        }
        content.innerHTML = html;
    }
    overlay.classList.add("show");
}

function showMessage(button, message) {
    var oldText = button.textContent;
    button.textContent = message;
    button.disabled = true;
    setTimeout(function () {
        button.textContent = oldText;
        button.disabled = false;
    }, 900);
}

/* -------------------- 6. Tìm kiếm và lọc sản phẩm -------------------- */
function applyProductFilters() {
    var keywordInput = document.getElementById("quick-search");
    var minInput = document.getElementById("min-price");
    var maxInput = document.getElementById("max-price");
    var colorInput = document.getElementById("filter-color");
    var ratingInput = document.getElementById("filter-rating");
    var categoryInput = document.getElementById("filter-category");

    var keyword = keywordInput ? keywordInput.value.toLowerCase().trim() : "";
    var minPrice = minInput && minInput.value !== "" ? Number(minInput.value) : 0;
    var maxPrice = maxInput && maxInput.value !== "" ? Number(maxInput.value) : Infinity;
    var color = colorInput ? colorInput.value : "";
    var minRating = ratingInput && ratingInput.value !== "" ? Number(ratingInput.value) : 0;
    var category = categoryInput ? categoryInput.value : "";

    var filtered = products.filter(function (product) {
        var matchKeyword = product.title.toLowerCase().indexOf(keyword) !== -1;
        var matchPrice = product.price >= minPrice && product.price <= maxPrice;
        var matchColor = !color || product.colors.indexOf(color) !== -1;
        var matchRating = !minRating ||
            (productRatings[product.id] || product.apiRating || 0) >= minRating;
        var matchCategory = !category || product.category === category;
        return matchKeyword && matchPrice && matchColor && matchRating && matchCategory;
    });

    renderProducts(filtered);
}

function setupStoreEvents() {
    var searchForm = document.getElementById("quick-search-form");
    var filterForm = document.getElementById("filter-form");
    var minPrice = document.getElementById("min-price");
    var maxPrice = document.getElementById("max-price");
    var openCart = document.getElementById("open-cart");
    var closeCart = document.getElementById("close-cart");
    var cartOverlay = document.getElementById("cart-overlay");
    var checkoutButton = document.getElementById("checkout-button");
    var checkoutOverlay = document.getElementById("checkout-overlay");
    var closeCheckout = document.getElementById("close-checkout");
    var detailOverlay = document.getElementById("detail-overlay");
    var closeDetail = document.getElementById("close-detail");
    var cartContent = document.getElementById("mini-cart-content");

    if (searchForm) searchForm.addEventListener("submit", function (e) {
        e.preventDefault(); applyProductFilters();
    });
    if (filterForm) filterForm.addEventListener("submit", function (e) {
        e.preventDefault();
        validatePriceRange();
        if (!filterForm.checkValidity()) {
            filterForm.reportValidity();
            return;
        }
        applyProductFilters();
    });
    if (filterForm) filterForm.addEventListener("reset", function () {
        setTimeout(function () {
            if (minPrice) minPrice.setCustomValidity("");
            if (maxPrice) maxPrice.setCustomValidity("");
            renderProducts(products);
        }, 0);
    });

    if (minPrice) minPrice.addEventListener("input", validatePriceRange);
    if (maxPrice) maxPrice.addEventListener("input", validatePriceRange);
    if (maxPrice) maxPrice.addEventListener("change", validatePriceRange);

    if (openCart) openCart.addEventListener("click", function () { cartOverlay.classList.add("show"); });
    if (closeCart) closeCart.addEventListener("click", function () { cartOverlay.classList.remove("show"); });
    if (checkoutButton) checkoutButton.addEventListener("click", function () {
        if (CartState.items.length === 0) {
            alert("Giỏ hàng đang trống.");
            return;
        }
        cartOverlay.classList.remove("show");
        checkoutOverlay.classList.add("show");
    });
    if (closeCheckout) closeCheckout.addEventListener("click", function () { checkoutOverlay.classList.remove("show"); });
    if (closeDetail) closeDetail.addEventListener("click", function () { detailOverlay.classList.remove("show"); });

    /* Các nút tăng/giảm/xóa trong mini-cart dùng delegation riêng trên nội dung giỏ hàng. */
    if (cartContent) cartContent.addEventListener("click", function (e) {
        var actionButton = e.target.closest("[data-cart-action]");
        if (actionButton) {
            CartState.changeQuantity(Number(actionButton.getAttribute("data-index")), actionButton.getAttribute("data-cart-action"));
        }
    });

    [cartOverlay, checkoutOverlay, detailOverlay].forEach(function (overlay) {
        if (overlay) overlay.addEventListener("click", function (e) {
            if (e.target === overlay) overlay.classList.remove("show");
        });
    });

    setupProductEventDelegation();
}

function validatePriceRange() {
    var minPrice = document.getElementById("min-price");
    var maxPrice = document.getElementById("max-price");
    if (!minPrice || !maxPrice) return;
    var hasInvalidRange = minPrice.value !== "" && maxPrice.value !== "" &&
        Number(minPrice.value) > Number(maxPrice.value);
    maxPrice.setCustomValidity(hasInvalidRange ? "Giá cao nhất phải lớn hơn hoặc bằng giá thấp nhất." : "");
}

/* -------------------- 7. Validate form thanh toán bằng Regex -------------------- */
function validateCheckoutField(fieldId) {
    var input = document.getElementById(fieldId);
    var error = document.getElementById(fieldId + "-error");
    if (!input || !error) return true;

    var value = input.value.trim();
    var message = "";

    if (fieldId === "checkout-name" && value.length < 2) {
        message = "Vui lòng nhập họ tên (ít nhất 2 ký tự).";
    } else if (fieldId === "checkout-email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        message = "Email chưa đúng định dạng.";
    } else if (fieldId === "checkout-phone" && !/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(value)) {
        message = "Số điện thoại Việt Nam chưa đúng định dạng.";
    } else if (fieldId === "checkout-address" && value.length < 8) {
        message = "Vui lòng nhập địa chỉ giao hàng đầy đủ.";
    }

    error.textContent = message;
    input.style.borderColor = message ? "#c0392b" : "#2e8b57";
    return message === "";
}

function setupCheckoutValidation() {
    var fieldIds = ["checkout-name", "checkout-email", "checkout-phone", "checkout-address"];
    for (var i = 0; i < fieldIds.length; i++) {
        (function (fieldId) {
            var input = document.getElementById(fieldId);
            if (input) {
                input.addEventListener("blur", function () { validateCheckoutField(fieldId); });
                input.addEventListener("keyup", function () { validateCheckoutField(fieldId); });
            }
        })(fieldIds[i]);
    }

    var form = document.getElementById("checkout-form");
    if (!form) return;

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        var valid = true;
        for (var j = 0; j < fieldIds.length; j++) {
            if (!validateCheckoutField(fieldIds[j])) valid = false;
        }
        if (!valid) return;
        if (CartState.items.length === 0) {
            alert("Giỏ hàng đang trống.");
            return;
        }

        /* Đóng gói dữ liệu đơn hàng thành object rồi lưu dưới dạng JSON trong LocalStorage. */
        var order = {
            order_id: "BW-" + new Date().getTime(),
            created_at: new Date().toISOString().slice(0, 10),
            employee: "Chưa phân công",
            customer: {
                fullname: document.getElementById("checkout-name").value.trim(),
                email: document.getElementById("checkout-email").value.trim(),
                phone: document.getElementById("checkout-phone").value.trim(),
                address: document.getElementById("checkout-address").value.trim()
            },
            items: CartState.items,
            total: CartState.calculateTotal(),
            status: "Chờ xử lý"
        };

        var savedOrders = [];
        try {
            savedOrders = JSON.parse(localStorage.getItem("bw08_orders") || "[]");
        } catch (error) {
            savedOrders = [];
        }
        savedOrders.push(order);
        localStorage.setItem("bw08_orders", JSON.stringify(savedOrders));

        CartState.items = [];
        CartState.save();
        CartState.renderMiniCart();
        form.reset();
        document.getElementById("checkout-overlay").classList.remove("show");
        alert("Đặt hàng thành công! Mã đơn: " + order.order_id);
    });
}

/* -------------------- 8. Khởi tạo trang cửa hàng -------------------- */
function initializeStore() {
    CartState.load();
    setupStoreEvents();
    setupCheckoutValidation();
    /* Tải hai nguồn XML; chỉ render sản phẩm sau khi đã có cả sản phẩm và đánh giá. */
    Promise.all([
        loadProductsDocument(),
        loadXmlFile("data/reviews.xml")
    ]).then(function (documents) {
        products = parseProducts(documents[0]);
        reviews = parseReviews(documents[1]);
        renderProducts(products);
    }).catch(function (error) {
        var skeleton = document.getElementById("product-skeleton");
        var container = document.getElementById("product-list-container");
        if (skeleton) skeleton.classList.add("hidden");
        if (container) container.innerHTML = '<p class="empty-state">Không tải được dữ liệu. Hãy chạy website bằng Live Server hoặc máy chủ web.</p>';
        console.error(error);
    });
}

/* =========================================================
   9. ADMIN: đăng nhập, thống kê và quản lý đơn hàng
   ========================================================= */
var adminOrders = [];
var adminProducts = [];

function initializeAdmin() {
    var loginForm = document.getElementById("admin-login-form");
    if (!loginForm) return;

    loginForm.addEventListener("submit", function (e) {
        e.preventDefault();
        loginAdmin();
    });

    var logoutButton = document.getElementById("admin-logout");
    if (logoutButton) logoutButton.addEventListener("click", function () {
        sessionStorage.removeItem("bw08_admin");
        document.getElementById("admin-dashboard").classList.add("hidden");
        document.getElementById("admin-login-section").classList.remove("hidden");
    });

    var reloadButton = document.getElementById("reload-orders");
    if (reloadButton) reloadButton.addEventListener("click", loadAdminData);

    /* Nếu phiên đăng nhập vẫn còn trong sessionStorage, mở dashboard. */
    var savedAdmin = sessionStorage.getItem("bw08_admin");
    if (savedAdmin) {
        document.getElementById("admin-login-section").classList.add("hidden");
        document.getElementById("admin-dashboard").classList.remove("hidden");
        document.getElementById("admin-welcome").textContent = "Xin chào, " + savedAdmin;
        loadAdminData();
    }
}

function loginAdmin() {
    var username = document.getElementById("admin-username").value.trim();
    var password = document.getElementById("admin-password").value;
    var errorElement = document.getElementById("login-error");

    /* employees.json được tải bằng fetch. Mật khẩu ở đây chỉ là dữ liệu demo phía client. */
    fetch("data/employees.json")
        .then(function (response) {
            if (!response.ok) throw new Error("Không đọc được employees.json");
            return response.json();
        })
        .then(function (employees) {
            var matchedEmployee = null;
            for (var i = 0; i < employees.length; i++) {
                if (employees[i].username === username &&
                    employees[i].password === password &&
                    employees[i].role === "admin") {
                    matchedEmployee = employees[i];
                    break;
                }
            }

            if (!matchedEmployee) {
                errorElement.textContent = "Tên đăng nhập hoặc mật khẩu không chính xác.";
                return;
            }

            sessionStorage.setItem("bw08_admin", matchedEmployee.fullname);
            document.getElementById("admin-login-section").classList.add("hidden");
            document.getElementById("admin-dashboard").classList.remove("hidden");
            document.getElementById("admin-welcome").textContent = "Xin chào, " + matchedEmployee.fullname;
            errorElement.textContent = "";
            loadAdminData();
        })
        .catch(function (error) {
            errorElement.textContent = "Không tải được dữ liệu đăng nhập. Hãy chạy bằng Live Server.";
            console.error(error);
        });
}

/* Đọc đơn mẫu từ carts.xml, sau đó ghép đơn mới trong LocalStorage. */
function loadAdminData() {
    Promise.all([
        loadXmlFile("data/carts.xml"),
        loadProductsDocument()
    ]).then(function (documents) {
        adminOrders = parseCartOrders(documents[0]);
        adminProducts = parseProducts(documents[1]);

        var localOrders = [];
        try {
            localOrders = JSON.parse(localStorage.getItem("bw08_orders") || "[]");
        } catch (error) {
            localOrders = [];
        }

        /* Gộp dữ liệu: đơn mẫu XML + đơn mới do khách hàng đặt trên trình duyệt. */
        adminOrders = adminOrders.concat(localOrders);
        renderAdminDashboard();
    }).catch(function (error) {
        console.error(error);
        alert("Không thể tải dữ liệu quản trị. Hãy kiểm tra các file XML.");
    });
}

function parseCartOrders(xmlDocument) {
    var orderNodes = xmlDocument.getElementsByTagName("order");
    var result = [];

    for (var i = 0; i < orderNodes.length; i++) {
        var node = orderNodes[i];
        var itemNodes = node.getElementsByTagName("item");
        var items = [];
        var total = 0;

        for (var j = 0; j < itemNodes.length; j++) {
            var itemNode = itemNodes[j];
            var item = {
                id: getXmlText(itemNode, "product_id"),
                title: getXmlText(itemNode, "product_title"),
                price: Number(getXmlText(itemNode, "price")),
                quantity: Number(getXmlText(itemNode, "quantity")),
                variant: getXmlText(itemNode, "variant")
            };
            items.push(item);
            total += item.price * item.quantity;
        }

        result.push({
            order_id: getXmlText(node, "order_id"),
            created_at: getXmlText(node, "created_at"),
            employee: getXmlText(node, "employee"),
            customer: { fullname: getXmlText(node, "customer") },
            items: items,
            total: total,
            status: getXmlText(node, "status")
        });
    }
    return result;
}

function renderAdminDashboard() {
    var orderCount = document.getElementById("stat-order-count");
    var revenue = document.getElementById("stat-revenue");
    var productCount = document.getElementById("stat-product-count");
    var ordersBody = document.getElementById("orders-table-body");
    var bestBody = document.getElementById("best-seller-body");

    if (!ordersBody || !bestBody) return;

    var totalRevenue = 0;
    var salesByProduct = {};

    for (var i = 0; i < adminOrders.length; i++) {
        var order = adminOrders[i];
        totalRevenue += Number(order.total || 0);

        for (var j = 0; j < order.items.length; j++) {
            var item = order.items[j];
            if (!salesByProduct[item.id]) {
                salesByProduct[item.id] = { title: item.title, quantity: 0, revenue: 0 };
            }
            salesByProduct[item.id].quantity += Number(item.quantity);
            salesByProduct[item.id].revenue += Number(item.price) * Number(item.quantity);
        }
    }

    orderCount.textContent = adminOrders.length;
    revenue.textContent = formatCurrency(totalRevenue);
    productCount.textContent = adminProducts.length;

    ordersBody.innerHTML = "";
    for (var k = 0; k < adminOrders.length; k++) {
        var current = adminOrders[k];
        var row = document.createElement("tr");
        row.innerHTML = '<td>' + escapeHtml(current.order_id) + '</td>' +
            '<td>' + escapeHtml(current.created_at) + '</td>' +
            '<td>' + escapeHtml(current.customer.fullname) + '</td>' +
            '<td>' + escapeHtml(current.employee) + '</td>' +
            '<td>' + formatCurrency(current.total) + '</td>' +
            '<td>' + escapeHtml(current.status) + '</td>';
        ordersBody.appendChild(row);
    }

    /* Chuyển object thống kê thành mảng, sắp xếp theo số lượng giảm dần. */
    var bestSellers = [];
    for (var productId in salesByProduct) bestSellers.push(salesByProduct[productId]);
    bestSellers.sort(function (a, b) { return b.quantity - a.quantity; });

    bestBody.innerHTML = "";
    if (bestSellers.length === 0) {
        bestBody.innerHTML = '<tr><td colspan="3">Chưa có dữ liệu bán hàng.</td></tr>';
    } else {
        for (var m = 0; m < bestSellers.length; m++) {
            var best = bestSellers[m];
            var bestRow = document.createElement("tr");
            bestRow.innerHTML = '<td>' + escapeHtml(best.title) + '</td>' +
                '<td>' + best.quantity + '</td>' +
                '<td>' + formatCurrency(best.revenue) + '</td>';
            bestBody.appendChild(bestRow);
        }
    }
}

/* -------------------- 10. Điểm bắt đầu -------------------- */
document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("product-list-container")) initializeStore();
    if (document.getElementById("admin-login-form")) initializeAdmin();
});
