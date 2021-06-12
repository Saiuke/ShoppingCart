/* 
===========================================================
Hott Shop
===========================================================
*/
$(function () {

   /* Activa los tooltips */
   $('[data-toggle="tooltip"]').tooltip()
   $('[href="tooltip"]').tooltip()

   /**
    * Actualiza el carrito de compras al cargar la página.
    * Es posible recuperar el datos de una sesion anterior
    */
   ShoppingCart.updateCart();
   $("#compraSuceso").modal("show");

   /**
    * Actualiza el carrito de compras todas las veces que el usuario abre o cierra el modal
    */
   $("#modalCheckout").on("show.bs.modal", function (event) {
      ShoppingCart.updateCart();
   });

   $("#modalCheckout").on("hide.bs.modal", function (event) {
      ShoppingCart.updateCart();
   });

   /**
    * Responsable por procesar los filtros en la barra lateral
    */
   $(".catFilter").click(function () {
      $("#searchBar").val("");
      if ($(this).hasClass("activeFilter")) {
         $(this).removeClass("activeFilter");
         $("#removeFilter").remove().fadeOut();
         $("#limpiarBusc").fadeOut();
         clearFilter();
      } else {
         $(".catFilter").each(function () {
            $(this).removeClass("activeFilter");
            $("#removeFilter").fadeOut().remove();
         });
         let removeFilter = `<span class="text-danger" id="removeFilter">&nbsp&nbsp&nbsp<i class="fas fa-times-circle"></i></span>`;
         let filterValue = $(this).find("span").html();
         searchProds(filterValue);
         $(this).addClass("activeFilter");
         $(this).append(removeFilter);
      }
   });

   $(".checkoutButton").click(function () {
      if ($(".checkoutButton").hasClass("disabled")) {
         showError("checkoutError");
         return;
      }
      // Adicionar ícono de spinner al botón
      $(".checkoutButton").addClass("disabled");
      $(".checkoutButton").html(
         '<i class="fas fa-spinner fa-spin"></i>&nbsp;&nbsp;AGUARDE'
      );

      let orderInfo = getOrderInfo();

      addProdOrder().done(() => {
         ShoppingCart.checkout().done(() => {
            $.ajax({
               type: "POST",
               url: "requests.php",
               data: {
                  action: "stripe",
                  base_url: configURL,
                  orderInfo: orderInfo,
               },
               dataType: "JSON",
               success: function (data) {
                  ShoppingCart.clear();
               },
               error: function (data) {
                  showError("checkoutError");
               },
            });
         });
      });
   });
});
/**
 * Envía los datos el pedido al servidor
 */
function createOrder() {
   let orderInfo = getOrderInfo();
   return $.ajax({
      type: "POST",
      url: "requests.php",
      data: {
         action: "setOrder",
         orderInfo: orderInfo,
      },
      dataType: "JSON",
      success: function (data) {
         return data;
      },
      error: function (data) {
         showError("orderError");
      },
   });
}

/**
 * Adiciona los productos al pedido
 */
function addProdOrder() {
   let productList = JSON.stringify(ShoppingCart.getCart());
   return createOrder()
      .done(() => {
         return $.ajax({
            type: "POST",
            url: "requests.php",
            data: {
               action: "addProducts",
               prodList: productList,
            },
            dataType: "JSON",
            success: function (data) {
               return data;
            },
            error: function (data) {
               showError("orderError");
               return data;
            },
         });
      })
      .fail(() => {
         return false;
      });
}

/**
 * Mustra mensages de error
 * @param {*} errorId
 */
function showError(errorId = null) {
   let errorTemplate = `<i class="fas fa-exclamation-triangle"></i>&nbsp;&nbsp;{{errorMessage}}&nbsp;&nbsp;<i class="fas fa-exclamation-triangle"></i>`;
   const errorList = {
         generalError: "Ocurrió un error al procesar su pedido. Por favor actualice la página e intente de nuevo",
         checkoutError: "Ocurrió un error al hacer el checkout de su pedido. Por favor actualice la página e intente de nuevo",
         orderError: "Ocurrió un error al enviar su pedido al servidor. Por favor actualice la página e intente de nuevo",
         cartError: "Ocurrió un error al adicionar un producto al carrito. Por favor actualice la página e intente de nuevo",
      },
      errorMessage =
      errorId == null ? errorList["generalError"] : errorList[errorId];
   $("#errorMessage")
      .html(errorTemplate.replace("{{errorMessage}}", errorMessage))
      .fadeIn();
   $("#modalCheckout").modal("hide");
   /* setTimeout(function () {
   	location.reload();
   }, 5000); */
}

/**
 * Obtiene datos del cliente y número del pedido
 */
function getOrderInfo() {
   return $(".checkoutButton").attr("orderInfo");
}

/**
 * Controla la funcionalidad de búsqueda de productos
 *
 * @param {string} searchParam
 */
function searchProds(searchParam = null) {
   $("#limpiarBusc").fadeIn();
   searchText =
      searchParam == null ?
      $("#searchBar").val().toUpperCase() :
      searchParam.toUpperCase();
   let listProds = $(".prodItem");
   listProds.each(function (el) {
      prodName = $(this).find(".prodName").html().toUpperCase();
      if (prodName.indexOf(searchText) > -1) {
         $(this).fadeIn();
      } else {
         $(this).fadeOut();
      }
   });
}

/**
 * Limpia dos filtros y parametros de la búsqueda
 */
function clearFilter() {
   $("#searchBar").val("");
   let listProds = $(".prodItem");
   listProds.each(function () {
      $(this).fadeIn();
   });
   $(".catFilter").each(function () {
      $(this).removeClass("activeFilter");
      $("#removeFilter").fadeOut().remove();
   });
}

/**
 * Contiene una serie de funciones y propiedades del carrito de compras
 */
const ShoppingCart = {
   items: {},
   total: 0,
   promoCode: "",
   cantItems: 0,
   cartCounter: 0,
   cartTotal: 0,
   template: `
        <div class=" col-12 col-md-5 prodName">{{prodName}}</div>
        <div class="d-inline d-sm-flex col-12 col-md-7">
        <span class="btn-sm btn-outline-secondary prodPrecio">{{prodValue}} €</span>
        <span class="btn-sm btn-outline-secondary prodQuant ml-1">{{prodQuant}}</span>
        <span class="btn-sm btn-outline-secondary prodQuant ml-1 d-none">-{{prodDiscount}}</span>
        <button type="button" class="btn btn-sm btn-warning ml-1" onclick="ShoppingCart.decreaseQuant({{prodId}})"><i class="fas fa-minus"></i></button>
        <button type="button" class="btn btn-sm btn-info ml-1" onclick="ShoppingCart.increaseQuant({{prodId}})"><i class="fas fa-plus"></i></button>
        <button type="button" class="btn btn-sm btn-danger deleteProd" onclick="ShoppingCart.removeItem({{prodId}})"><i class="fas fa-trash"></i></button>
        </div>`,

   /**
    * Obtiene informaciones del carrito de localStorage y actualiza la array
    *
    * @returns array
    */
   getCart: () => {
      if (
         localStorage.getItem("CartItems") == null ||
         localStorage.getItem("CartItems") == ""
      ) {
         ShoppingCart.setCart();
      } else {
         let storedCart = localStorage.getItem("CartItems");
         storedCart = JSON.parse(storedCart);
         ShoppingCart.items = storedCart;
         return storedCart;
      }
   },

   /**
    * Almacena informaciones del carrito actual en localStorage
    */
   setCart: (newCart = null) => {
      currentCart = newCart == null ? ShoppingCart.items : newCart;
      currentCart = JSON.stringify(currentCart);
      localStorage.removeItem("CartItems");
      localStorage.setItem("CartItems", currentCart);
   },

   /**
    * Actualiza el carrito de compras de averiguando si hay nuevos itens, o itens a seren eliminados
    */
   updateCart: () => {
      let currentCart = ShoppingCart.getCart();
      let prodCount = Object.keys(currentCart).length;
      let renderedProds = $(".cartItem");

      if (prodCount != renderedProds.length) {
         //  Adiciona o actualiza los productos del carrito
         for (const [key, prod] of Object.entries(currentCart)) {
            let prodId = key;
            if (!$("#prod_" + prodId).length) {
               ShoppingCart.renderItem(
                  prodId,
                  prod.name,
                  prod.value,
                  prod.disc,
                  prod.qnty
               );
            }
         }
         //  Remueve productos que fueron eliminados del carrito
         renderedProds.each(function (el) {
            elementId = $(this).attr("id");
            prodId = elementId.split("_").pop();
            if (!currentCart[prodId]) {
               ShoppingCart.removeItem(prodId);
            }
         });
         ShoppingCart.updateCartCounter();
      } else {
         //  Monitorea cambios en las cantidades de los productos
         for (const [key, prod] of Object.entries(currentCart)) {
            let prodId = key;
            let prodQuant = prod.qnty;
            if (prodQuant != $("#prod_" + prodId + " .prodQuant").html()) {
               ShoppingCart.updateQuant(prodId, prod.qnty);
            }
         }
      }
      ShoppingCart.updateTotal();
   },

   /**
    * Renderiza cada producto dentro del carrito de compras
    *
    * @param {*} prodId
    * @param {*} prodName
    * @param {*} prodValue
    * @param {*} prodQuant
    */
   renderItem: (
      prodId,
      prodName,
      prodValue,
      prodDiscount = null,
      prodQuant
   ) => {
      let newProd = ShoppingCart.template;

      prodValue = prodValue.length == 1 ? '0' + prodValue : prodValue;
      prodQuant = prodQuant <= 9 ? '0' + prodQuant : prodQuant;

      newProd = newProd.replace("{{prodName}}", prodName);
      newProd = newProd.replace("{{prodValue}}", prodValue);
      newProd = newProd.replace("{{prodDiscount}}", prodDiscount);
      newProd = newProd.replace("{{prodQuant}}", prodQuant);
      newProd = newProd.replaceAll("{{prodId}}", prodId);
      let newLi = document.createElement("li");
      $(newLi).addClass(
         "d-flex row justify-content-between mb-2 pb-2 border-bottom w-100 cartItem"
      );
      newLi.id = "prod_" + prodId;
      newLi.innerHTML = newProd;
      $("#cartProdList").append(newLi).fadeIn(1000);
   },

   /**
    * Actualiza la cantidad de un determinado producto del carrito de compras
    *
    * @param {*} prodId
    * @param {*} prodQuant
    */
   updateQuant: (prodId, prodQuant) => {
      prodQuant = prodQuant < 1 ? 1 : prodQuant;
      let currentCart = ShoppingCart.items;
      let prodActual = currentCart[prodId];
      prodActual.qnty = prodQuant;
      ShoppingCart.setCart();
      $("#prod_" + prodId + " .prodQuant").html(prodQuant);
      ShoppingCart.updateTotal();
   },

   /**
    * Aumenta la cantidad de n determinado producto del carrito de compras
    *
    * @param {*} prodId
    */
   increaseQuant: (prodId) => {
      let prodQuant = $("#prod_" + prodId + " .prodQuant").html();
      prodQuant++;
      ShoppingCart.updateQuant(prodId, prodQuant);
   },

   /**
    * Disminuye la cantidad de n determinado producto del carrito de compras
    *
    * @param {*} prodId
    */
   decreaseQuant: (prodId) => {
      ShoppingCart.getCart();
      let prodQuant = $("#prod_" + prodId + " .prodQuant").html();
      prodQuant--;
      ShoppingCart.updateQuant(prodId, prodQuant);
   },

   /**
    * Adiciona un nuevo item al carrito de compras
    *
    * @param {*} prodId
    */
   addItem: (prodId) => {
      return new Promise((resolve, reject) => {
         ShoppingCart.getProd(prodId)
            .done(function (data) {
               let currentCart = ShoppingCart.getCart();
               let prodId = data.id;
               let prodName = data.name;
               let prodDesc = data.description;
               let prodValue = data.value;
               let prodDiscount = 0;
               let prodQuant = 1;
               if (currentCart[prodId]) {
                  currentCart[prodId].qnty++;
                  ShoppingCart.increaseQuant(prodId);
               } else {
                  currentCart[prodId] = {
                     name: prodName,
                     desc: prodDesc,
                     value: prodValue,
                     discount: prodDiscount,
                     qnty: 1,
                  };
                  ShoppingCart.setCart(currentCart);
                  ShoppingCart.renderItem(
                     prodId,
                     prodName,
                     prodValue,
                     prodDiscount,
                     prodQuant
                  );
                  ShoppingCart.updateCartCounter();
                  ShoppingCart.updateTotal();
                  resolve();
               }
            })
            .fail(() => {
               reject();
            });
      });
   },

   /**
    * Remueve un item del carrito de compras
    *
    * @param {*} prodId
    */
   removeItem: (prodId) => {
      let currentCart = ShoppingCart.getCart();
      if (currentCart[prodId]) {
         delete currentCart[prodId];
         ShoppingCart.setCart(currentCart);
      }
      $("#prod_" + prodId)
         .remove()
         .fadeOut();
      ShoppingCart.updateCartCounter();
      ShoppingCart.updateTotal();
   },

   /**
    * Remueve todos los productos del carrito de compras
    */
   clear: () => {
      let currentCart = ShoppingCart.getCart();
      for (const [key, prod] of Object.entries(currentCart)) {
         delete currentCart[key];
      }
      ShoppingCart.setCart(currentCart);
      ShoppingCart.updateCartCounter();
      ShoppingCart.updateTotal();
   },

   /**
    * Actualiza la cantidad total de los productos dentro del carrito de compras
    */
   updateCartCounter: () => {
      let currentCart = ShoppingCart.getCart();
      let currentCounter = Object.keys(currentCart).length;
      $(".cartCounter").html(currentCounter);
   },

   /**
    * Retorna el valor total del carrito de compras
    * @returns
    */
   getTotal: () => {
      let currentCart = ShoppingCart.getCart();
      let currentTotal = 0;
      for (const [key, prod] of Object.entries(currentCart)) {
         currentTotal += parseFloat(prod.value) * prod.qnty;
      }
      return currentTotal;
   },

   /**
    * Actualiza el valor total de los productos dentro del carrito de compras
    */
   updateTotal: () => {
      let currentTotal = ShoppingCart.getTotal();
      ShoppingCart.cartTotal = currentTotal;
      $("#totalValue").html(currentTotal + " €");
      if (currentTotal == 0) {
         $(".checkoutButton").addClass("disabled");
      } else {
         $(".checkoutButton").removeClass("disabled");
      }
   },

   /**
    * Obtiene las informaciones de un producto
    *
    * @param {*} prodId
    * @returns
    */
   getProd: (prodId) => {
      return $.ajax({
         type: "POST",
         url: "requests.php",
         dataType: "json",
         data: {
            action: "getProduct",
            prodId: prodId,
         },
         success: function (data) {
            return data;
         },
         error: function (error) {
            showError("cartError");
         },
      });
   },

   /**
    * Hace el checkout instantaneo de un producto específico
    * @param {*} prodId
    */
   instantCheckout: (prodId) => {
      $(".btn").addClass("disabled");
      $("#instantCheck_" + prodId).html(
         '<i class="fas fa-spinner fa-spin"></i>'
      );
      ShoppingCart.clear();
      ShoppingCart.addItem(prodId).then(() => {
         $(".checkoutButton").click();
      });
   },

   checkout: () => {
      let currentCart = JSON.stringify(ShoppingCart.getCart());
      return $.ajax({
         type: "POST",
         url: "requests.php",
         dataType: "json",
         data: {
            action: "getTotal",
            currentCart: currentCart,
         },
         success: function (data) {
            console.log(data);
         },
         error: function (error) {
            showError("cartError");
         },
      });
   },
};